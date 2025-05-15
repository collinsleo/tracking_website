// module
const express = require("express")
const ejs = require("ejs")
const path = require('path')
const bodyParser = require("body-parser")
const pg = require("pg")
const {body, validationResult }= require("express-validator")
const bcrypt = require("bcrypt")
const session = require("express-session")
const pgSession = require('connect-pg-simple')(session)
const passport = require('passport');
const strategy = require("passport-local").Strategy;
const flash = require('connect-flash')
const env = require("dotenv")
const moment = require("moment")
const cron = require("node-cron")
const {Pool} = require('pg')
// const { userInfo } = require("os")
const ms = require("ms")
const { now } = require("moment/moment")
const { log } = require("console")
// const expreesLayout = require("express-ejs-layouts")
env.config();

// seting up server
const app = express();

// ====================================================================
// db connection
// ====================================================================
const db = new Pool({
    user:process.env.PG_USER,
    host:process.env.PG_HOST,
    database:process.env.PG_DATABASE,
    password:process.env.PG_PASSWORD,
    port:process.env.PG_PORT,

})

db.connect((err, client, done)=>{
    if(err){
        console.error("db connection error: ", err.message);
        return;
    }
    done();
})

// ====================================================================
// global - side ====== app.use
// ====================================================================


app.set('view engine', ejs)
// app.use(expreesLayout);
// app.set('layout', 'layout/dashboard.ejs')
app.use(express.static(path.join(__dirname,'public')));
app.use(bodyParser.urlencoded({extended:true}))

app.use(session({
    store: new pgSession({
        pool:db,
        tableName: 'session',
    }),
    secret:"mySecrete",
    resave:false,
    saveUninitialized:true,
    cookie:{
        maxAge: 1000 * 60 * 60 * 24,
    }
}))


app.use(flash())
app.use((req, res, next) => {
    res.locals.error_msg = req.flash('error');
    res.locals.success_msg = req.flash('success');
    next();
});

app.use(passport.initialize())//start passport
app.use(passport.session())//Middleware that will restore login state from a session.
app.set('view engine', 'ejs');

// setting up global variables for ejs
app.use(async(req,res,next)=>{
    res.locals.userinfo = req.user

    const now = Date.now();
    const notifyResult = await db.query(
        "SELECT * FROM tracking_history where status in ('delayed','arrived','delivered') and notify_me = 'false' order by id desc"
    )

    const totalPacels = await db.query(
        "SELECT COUNT(*) as count  FROM parcels"
    )
    const totalPacel = totalPacels.rows[0].count;
    

    res.locals.details={
        parcelInTransit :  await counting("in transit"),
        parcelDelay :  await counting("delayed"),
        parcelarrived :  await counting("arrived"),
        parcelcompleted :  await counting("delivered"),
        parcelproccess :  await counting("processing"),
        parcelfrozen :  await counting("frozen"),
        totalPacel: totalPacel,
        countnotification : notifyResult.rowCount || 0,

    }
    
    const notification = notifyResult.rows
    
    notification.forEach(notify => {
        if(notify.status == "delayed") {
            notify.url =`/newissue/${notify.tracking_id}?notify_id=${notify.id}`
        }               
        if(notify.status == "arrived" || notify.status == "delivered") {
            notify.url =`/newroute/${notify.tracking_id}?notify_id=${notify.id}`
        }

        notify.time = `${Math.floor((now - notify.created_at) / (1000*60))}`   
        if(notify.time < 60){
            notify.time = `${Math.floor((now - notify.created_at) / (1000*60))} min` 
        }else if(notify.time < 1440){
            notify.time = `${Math.floor((now - notify.created_at) / (1000*60*60))} hr` 
        }else if(notify.time < 10080) {
            notify.time = `${Math.floor((now - notify.created_at) / (1000*60*60*24))} days` 
               
        }else if(notify.time < 43,200) {
            notify.time = `${Math.floor((now - notify.created_at) / (1000*60*60*24 *7))} week` 
               
        }else  {
            notify.time = `${Math.floor((now - notify.created_at) / (1000*60*60*24 * 30))} month` 
        }       
    })

    res.locals.notification=notification;

    next();
})


// routes 
// ====================================================================
// clients - side
// ====================================================================
app.get("/", (req,res)=>{
    res.render("client-side/index.ejs")
})
app.get("/about", async(req,res)=>{
    res.render("client-side/about.ejs")
})
app.get("/contact", async(req,res)=>{
    res.render("client-side/contact.ejs")
})
app.get("/faq", async(req,res)=>{
    res.render("client-side/faq.ejs")
})


    // login system
app.get("/login", (req,res)=>{
    res.render("logins/login.ejs")
})


app.post("/login",
    passport.authenticate('local',{
        successRedirect: '/dashboard',
        failureRedirect:'/login',
        failureFlash: true
    })
    
)

// ====================================================================
// logins - side
// ====================================================================


app.get("/register",(req,res)=>{
    res.render("logins/register.ejs")
})

app.post("/register",
    [
        body('name', "name must be at least 3 character").exists().isLength({min:3}).trim().escape(),
        body('mobile', "mobile must at least 11 character").exists().isLength({min:11}).trim().escape(),
        body('email', "email address is not valid").isEmail().normalizeEmail(),
        body('password',"password must be at least 6 characters").trim().isLength({min:6}).escape()
    ], 
    async(req,res)=>{
        const {name, mobile, email, password, confirm} = req.body
        const errors = validationResult(req)
        
        if(!errors.isEmpty()){
            const alert = errors.array();
            const errorAlert = []
            alert.forEach(element => {
                errorAlert.push(element.msg)               
            });       
            
            res.render("logins/register.ejs", {error: errorAlert[0]});  

        }else if(password !== confirm){
            res.render("logins/register.ejs", {error: "passwords are not matching"});  
        }else{
            try{
                 
                const checkExistingUser = await db.query(
                    "SELECT * FROM users WHERE email=$1 or mobile = $2", [email, mobile]
                )     
        
                if(checkExistingUser.rows.length > 0){
                    res.render("logins/register.ejs", {error: "user already exist; Try loging in"})
                    
                }else{
                    const role = "admin";
                    const sort = 10
                    const passwordHash = await bcrypt.hash(password, sort)
                                        
                    const addUser = await db.query(
                        "INSERT INTO users (name, mobile, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING *",[name, mobile, email, passwordHash, role]
                    )  
                    const user = addUser.rows[0];
                    
                    req.login(user, (err)=>{
                        console.log(err);
                        res.redirect("/dashboard")
                        
                    })
                    
                }
        
            }catch (err) {
                console.error("registration request failed: ", err.message);
                res.render('logins/register.ejs', {error: "we couldn't complete your registration. Try again shortly "})
                
            }
        }

    
    }
)


passport.use('local',
    new strategy(
        {usernameField:"username"},
        async function verify(username, password, done) {
            
            try{
                const checkUser = await db.query(
                    "SELECT * FROM users WHERE email = $1 or mobile = $1",[username]
                )
                if(checkUser.rows.length < 1){
                    return done(null, false,{message:"login failed, user not found"})
                }else{
                    const userPassword = checkUser.rows[0].password
                    const checkPassword = await bcrypt.compare(password, userPassword)
                    if(!checkPassword){
                        console.log("login failed, please check your");
                        
                        return done(null, false, {message: "login failed, please check your credentials"})
                    }else{
                        const user = checkUser.rows[0]                      
                        return done(null, user)
                    }
                }

            }catch (err) {
                console.error("login request failed: " + err)
                return done("somthing went wrong, please try again later")

            }
            
        }
    )
)

passport.serializeUser((user, done)=>{
    done(null, user.id) // save the user id
})

passport.deserializeUser( async (id,done) =>{
    const user = await db.query(
        "SELECT * FROM users WHERE id = $1", [id]
    )
    done(null, user.rows[0])

})

app.get('/logout', (req, res) => {
    req.logout(function(err) {
      if (err) {
        return next(err);
      }
      req.session.destroy(() => {
        res.clearCookie('connect.sid'); // Important: clears session cookie
        res.redirect('/login'); // Redirect to login or homepage
      });
    });
  });
  




// admin
// ====================================================================
// admin - side
// ====================================================================

function isAuthenticated(req, res, next) {
    if(req.isAuthenticated()) return next();
    req.flash('error', "can't access this page");
    res.redirect('/login')   
}

async function counting(status) {
    const totalCount = await db.query(
        "SELECT COUNT(*) FROM parcels WHERE status = $1",[status]
    )
    const result = totalCount.rows[0].count;
    return result
    
}

// cron jobs ===============================
cron.schedule('*/5 * * * *', async () => {
    try{
        const now =  new Date(Date.now());
        const results = await db.query(`
            SELECT parcels.*, routes.id as route_id, routes.status, routes,from_location, routes.to_location, routes.status as route_status FROM parcels JOIN routes ON parcels.tracking_id = routes.tracking_id WHERE parcels.expected_arrival_time < $1 AND parcels.status = 'in transit' AND routes.status = 'in transit' `, [now]
        );
        const result = results.rows;

        if(result.length > 0){
            result.forEach ( async element=>{
                const delay = now - element.expected_arrival_time
                if(Math.floor(delay/(1000*60*60)) >= 1){
                    const description = `the parcel is expected to arrive ${element.expected_arrival_time} 
                    but have not arrived is currentry delayed for about ${Math.floor(delay/(1000*60*60))} hour`;
                    
                    
                    await db.query(
                        "INSERT INTO problem_reports (parcel_id, route_id,reported_by,reporter_role,issue_type,priority,description) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                        [element.tracking_id, element.route_id,"system","system","late delivery","low",description]
                    )
                    await db.query(
                        "UPDATE  parcels SET status = $1 WHERE tracking_id = $2",["delayed", element.tracking_id]
                    )

                    await trackingHistory(element.tracking_id,element.route_id,"arrived late",element.from_location, element.to_location)
                    console.log( generateDescription("arrived late",element.from_location, element.to_location)); 
                }
            })
        }

                
    } catch (err) {
      console.error('Error updating arrival status:', err);
    }

  });

   

// // // end ofcron jobs ===============================

// dashboard ============================
app.get("/dashboard", isAuthenticated, async (req, res)=>{
    let {range} = req.query;
    let condition;
    if(range == undefined){
        condition = `WHERE created_at::date = CURRENT_DATE`
    }else if(range == 'week'){
        condition = `WHERE created_at::date >= CURRENT_DATE - INTERVAL '7 days'`
    }else if(range == 'month'){
        condition = `WHERE created_at::date >= CURRENT_DATE - INTERVAL '1 month'`
    }else{
        condition = `WHERE created_at::date = CURRENT_DATE`
    }

    try{
        const statusResult = await db.query(
            "SELECT status, COUNT(*) AS count FROM parcels GROUP BY status "
        )
        const statusData = {
            'processing':0,
            'in transit':0,
            'delayed':0,
            'arrived':0,
            'delivered':0
        }
        statusResult.rows.forEach(row=>{
            statusData[row.status] = parseInt(row.count);
        })

        const intervalStatus = await db.query(
            `SELECT status, COUNT(*) AS count FROM tracking_history ${condition} GROUP By status `
        )
        
        interval = {
            'processing':0,
            'in transit':0,
            'delayed':0,
            'arrived':0,
            'arrived late':0,
            'resolved':0,
            'delivered':0
        }
        intervalStatus.rows.forEach(row=>{
            interval[row.status] = parseInt(row.count);
        })
        
            

        res.render("admin/dashboard.ejs", {statusData, interval}) 
        
    }catch (err){
        console.log(err.message);
        
    }
       
})


// parcel ====================================
app.get("/newparcel",isAuthenticated, (req, res)=>{
    res.render("admin/add_parcel.ejs") 
})

// generating traking id 
function generateTrackingId() {
    const num = Math.round(Math.random()*99999)
    const alphnum = Math.random().toString(20).slice(2,12).toUpperCase()
    const trackid = `TRKID${num}${alphnum}`;
    return trackid
    
}

app.post("/newparcel",isAuthenticated,
    [
        body('sName').exists().withMessage("sender name must exist").notEmpty().withMessage("sender name is required")
        .isLength({min:3}).withMessage("sender name must be upto 3 characters").trim().escape(),
        body('sPhone').exists().withMessage("sender phone number must exist").notEmpty().withMessage("sender phone number is required")
        .matches(/^\d{10,15}$/).withMessage("receiver number musst be 10 to 15 digit").trim().escape(),
        body('rName').exists().withMessage("receiver name must exist").notEmpty().withMessage("receiver name is empty")
        .isLength({min:3}).withMessage("receivers name must be upto 3 characters").trim().escape(),
        body('rPhone').exists().withMessage("receiver phone number must exist").notEmpty().withMessage("receiver phone number is required")
        .matches(/^\d{10,15}$/).withMessage("receiver number musst be 10 to 15 digit").trim().escape(),        
        body('rEmail',"email is not valid" ).exists().isEmail().normalizeEmail(),
        body('pickup', "pickup location is required").exists().notEmpty().trim().escape(),
        body('destination', "pickup location is required").exists().notEmpty().trim().escape(),
        body('weight').optional().isFloat({gt:0}),
        body('desc').optional(),
        body('note').optional(),
    ],
    async (req, res)=>{
        const error = validationResult(req);

        if(!error.isEmpty()){
            const alert = error.array();
            const errorAlert = []
            alert.forEach(element => {
                errorAlert.push(element.msg)               
            });                
            
            res.render("admin/add_parcel.ejs", {error: errorAlert[0]});
        }else{
            const {sName, sPhone, rName, rPhone, rEmail, pickup, destination, weight, desc, note} =  req.body     
            const trackingId =  generateTrackingId()
            
            try{

                const addParcel  = await db.query(
                    "INSERT INTO parcels (tracking_id, sender_name, sender_phone, receiver_name, receiver_phone, receiver_email, pickup_location, delivery_location, weight, parcel_description, note) VALUES ($1,$2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
                    [trackingId, sName, sPhone, rName, rPhone, rEmail, pickup, destination, weight, desc, note]
                )

                trackingHistory(trackingId,route_id=null,"processing", from_location=null, to_location=null, issue=null)

                req.flash('success', "successfuly registered a parcel")
                res.redirect("/newroute/"+trackingId)

            }catch (err){
                console.error("ERROR:", err.message );

                res.render("admin/add_parcel.ejs", {error: "add parcel request failed"})
                
            }
        }
})
app.post("/parcel_update",isAuthenticated,
    [
        body('sName').exists().withMessage("sender name must exist").notEmpty().withMessage("sender name is required")
        .isLength({min:3}).withMessage("sender name must be upto 3 characters").trim().escape(),
        body('sPhone').exists().withMessage("sender phone number must exist").notEmpty().withMessage("sender phone number is required")
        .matches(/^\d{10,15}$/).withMessage("receiver number musst be 10 to 15 digit").trim().escape(),
        body('rName').exists().withMessage("receiver name must exist").notEmpty().withMessage("receiver name is empty")
        .isLength({min:3}).withMessage("receivers name must be upto 3 characters").trim().escape(),
        body('rPhone').exists().withMessage("receiver phone number must exist").notEmpty().withMessage("receiver phone number is required")
        .matches(/^\d{10,15}$/).withMessage("receiver number musst be 10 to 15 digit").trim().escape(),        
        body('rEmail',"email is not valid" ).exists().isEmail().normalizeEmail(),
        body('pickup', "pickup location is required").exists().notEmpty().trim().escape(),
        body('destination', "pickup location is required").exists().notEmpty().trim().escape(),
        body('weight').optional().isFloat({gt:0}),
        body('desc').optional(),
        body('note').optional(),
    ],
    async (req, res)=>{
        const error = validationResult(req);

        if(!error.isEmpty()){
            const alert = error.array();
            const errorAlert = []
            alert.forEach(element => {
                errorAlert.push(element.msg)               
            });                
            
            res.render("admin/add_parcel.ejs", {error: errorAlert[0]});
        }else{
            const {sName, sPhone, rName, rPhone, rEmail, pickup, destination, weight, desc, note,update_id, track_id} =  req.body     
            
            try{

                await db.query(
                    "Update parcels set sender_name = $1, sender_phone = $2, receiver_name = $3, receiver_phone = $4, receiver_email = $5, pickup_location = $6, delivery_location = $7, weight = $8, parcel_description = $9, note = $10 WHERE id = $11 and tracking_id = $12",
                    [sName, sPhone, rName, rPhone, rEmail, pickup, destination, weight, desc, note, update_id, track_id]
                )

                req.flash('success', "successfuly Updated a parcel")
                res.redirect("/parcel?tracking_id="+track_id)

            }catch (err){
                console.error("ERROR:", err.message );
                req.flash("error", "update arcel request failed")
                return res.redirect('/parcel_update?update_id='+update_id)
                
            }
        }
})


app.get('/parcel_update', isAuthenticated, async (req, res)=>{
    let {update_id}=req.query
    
    
    try{
        if(update_id == undefined){
            req.flash("error", "can't find this parcel")
            return res.redirect('/parcel')
        }else{

            const parcelResult = await db.query(
                "SELECT * FROM parcels WHERE id = $1",[update_id]
            )
            const parcel = parcelResult.rows[0]

            if(parcelResult.length < 1){
                req.flash("error", "can't find this parcel")
                return res.redirect('/parcel')
                
            }else{
                res.render("admin/update_parcel.ejs", {parcel})

            }
        }

    }catch (err){
        console.log(err.message);
        req.flash("error", "can't find this parcel")
        return res.redirect('/parcel')
        
    }
    

})


app.get('/parcel', isAuthenticated, async (req, res)=>{
    let {tracking_id}=req.query

    try{
        if(tracking_id != undefined){
            pacelResult= await db.query(
                "SELECT * FROM parcels WHERE tracking_id = $1 ORDER BY updated_at DESC",[tracking_id]
            )
            
        }else{
            pacelResult= await db.query(
                "SELECT * FROM parcels ORDER BY updated_at DESC"
            )
            
        }

        const parcels = pacelResult.rows;       
        
        parcels.forEach(parcel => {
            const arrival_time = parcel.expected_arrival_time;
            if(arrival_time == null){
                parcel.expected_arrival_time= null
            }else{
                parcel.expected_arrival_time=  moment(new Date(parcel.expected_arrival_time)).format('Do-MMMM-YYYY, h:mm A [GMT]Z ') 
            }
        });     
        

        res.render('admin/parcels.ejs', {parcels})
    }catch (err) {
        console.error("Parcel display request failed: ", err.message)
        res.render('admin/parcels.ejs', {error:"somthing went wrong during the parcel display, please try again"})

    }
})

//converting string time to date
function parseDuration(str) {
    const regex = /(\d+)\s*(day|hour|minute|second)s?/gi;
    let ms = 0;
    const unitToMs = {
      day: 86400000,
      hour: 3600000,
      minute: 60000,
      second: 1000
    };
  
    let match;
    while ((match = regex.exec(str)) !== null) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      ms += value * unitToMs[unit];
    }
  
    return new Date(Date.now() + ms);
  }
  
app.get('/parcel/:parcel_id/feeze', async (req, res)=>{
    const parcel_id = req.params.parcel_id;

    try{

        await db.query(
            "UPDATE parcels set is_active = $1, status = $2 where tracking_id = $3",[false,"frozen",parcel_id]
        )
        req.flash('success', "successfully deactivated a parcel")
        return res.redirect('/parcel')

    }catch (err){
        console.error(err.message);
        req.flash('error', "failed to deactivate parcel")
        return res.redirect('/parcel')

    }

})

app.get('/parcel/:parcel_id/unfreeze', async (req, res)=>{
    const parcel_id = req.params.parcel_id;

    try{
        const trackResult = await db.query(
            "Select * from tracking_history where tracking_id = $1 and status != 'resolved' order by id desc",[parcel_id]
        )
        const track = trackResult.rows 
        const status = track[0].status

        await db.query(
            "UPDATE parcels set is_active = $1, status = $2 where tracking_id = $3",[true,status,parcel_id]
        )
        req.flash('success', "successfully activated a parcel ")
        return res.redirect('/parcel')

    }catch (err){
        console.error(err.message);
        req.flash('error', "failed to  activate parcel")
        return res.redirect('/parcel')

    }

})
  
  

app.get('/parcel/:parcel_id/start', async (req, res)=>{
    const parcel_id = req.params.parcel_id;
    const status = "in transit"; 

    
    try{
        // route details
        const routechecks= await db.query(
            "SELECT * FROM routes WHERE tracking_id = $1 ORDER BY step_number ASC LIMIT 1",
            [parcel_id]
        )
        const routedetails= routechecks.rows
        
        // parcel details
        const parcelcheck= await db.query(
            "SELECT * FROM parcels WHERE tracking_id = $1 LIMIT 1",
            [parcel_id]
        )
        const parcelResult= parcelcheck.rows[0]
         
        //check parcel still on transit
        if(parcelResult.status == "in transit"){
            req.flash('error', "parcel is in transit, can't start next route")
            return res.redirect("/parcel");
        }else if(parcelResult.status == "delayed"){
            req.flash('error', "parcel has issue, can't start next route")
            return res.redirect("/parcel");
        }else if(parcelResult.status == "delivered"){
            req.flash('error', "parcel has reached its destination")
            return res.redirect("/parcel");
        }else if(routedetails.length < 1){
            req.flash('error', "parcel hasn't been assigned any route")
            return res.redirect("/parcel");
        }else{
            const routeResult= await db.query(
                "SELECT * FROM routes WHERE tracking_id = $1 and status = $2 ORDER BY step_number ASC LIMIT 1",
                [parcel_id,"pending"]
            )

            const routes = routeResult.rows[0];

            if(routes < 1){
                res.flash('error', "no pending route found for this parcel")
                return res.redirect("/parcel");
            }else{
                const current_location = `${routes.from_location} to ${routes.to_location}` ;
                const date = new Date();
                const arrival = parseDuration(routes.estimated_time);
                      
                console.log(arrival, current_location)
        //         // update arival and status
                await db.query(
                    "UPDATE routes set status = $1 WHERE id = $2", [status, routes.id]
                )
                
                await db.query(
                    "UPDATE parcels set status = $1, current_location = $2 , expected_arrival_time = $3 where tracking_id = $4", [status, current_location,arrival,parcel_id]
                )

                await trackingHistory(parcel_id,routes.id,status,routes.from_location, routes.to_location, issue=null)
                
                req.flash('success', "successfully started a parcel movement")
                return res.redirect("/parcel")
            }          

        }
        
    }catch (err) {
        console.error("Parcel display request failed: ", err.message)
        req.flash('error', "somthing went wrong during the parcel display, please try again")
        return res.redirect("/parcel")

    }
})

//end of parcel=================================


// routes and new routes=============================

app.get("/newroute/:tracking_id", isAuthenticated, async(req, res)=>{
    const track_id  = req.params.tracking_id;
    let {notify_id} = req.query

    if(notify_id == undefined ){
        notify_id="";
        
    }else{
        console.log("done!", notify_id);
        
        try{
            await db.query(
                "UPDATE tracking_history set notify_me = 'read' where id =$1 ",[notify_id]
            )
        }catch (err) {
            console.error("notification request failed", err.message)
            req.flash('error', "failed to mark as read")
            res.redirect("/newroute/"+track_id)
        }
    }
    

    try{
        //getting parcel destination
        const destination = await db.query(
            "SELECT delivery_location FROM parcels WHERE Tracking_id = $1"  , [track_id]
        )
        parcel_destination = destination.rows[0].delivery_location

        const routeResult = await db.query(
            "SELECT * FROM routes WHERE Tracking_id = $1  ORDER BY step_number ASC"  , [track_id]
        )
        const routes = routeResult.rows        
        
        res.render("admin/add_route.ejs",{track_id,routes, parcel_destination}) 

    }catch (err){
        console.error("Fetching routes data failed: ", err);          
        res.render("admin/add_route.ejs",{track_id, error: "can't fetch route table, try again later."}) 
    }


})

app.post("/newroute/:tracking_id",isAuthenticated,
    [
        body("track_id","invalide track id").exists().notEmpty().trim().escape(),
        body("from_location","starting location is required").exists().notEmpty().trim().escape(),
        body("to_location","stoping location is required").exists().notEmpty().trim().escape(),
        body("mode","Transit Mode is required").exists().notEmpty().trim().escape(),
        body("time","estimated time is required").exists().notEmpty().trim().escape(),
        body("order","Route order is required").exists().notEmpty().isNumeric().withMessage("route order must be a number").trim().escape(),
    ], 

    async(req, res)=>{
        const {track_id,from_location,to_location, mode, time, order} = req.body;

        const error = validationResult(req);
        const errorAlart = [];
        if(!error.isEmpty()){
            error.array().forEach(element => {
                errorAlart.push(element.msg)
            });
            req.flash("error", errorAlart[0])
            return res.redirect(`/newroute/${track_id}`)
            
        }else{
            
            try{

               

                const checkTrackid = await db.query(
                    "SELECT * FROM parcels WHERE tracking_id = $1", [track_id]
                )

                const checkrole = await db.query(
                    "SELECT * FROM routes WHERE step_number = $1 and tracking_id = $2", [order, track_id]
                )

                if(checkTrackid.rows.length < 1){
                    req.flash('error', "invalide TRACK_ID, parcel not found")
                    res.redirect(`/newroute/${track_id}`)
                    
                }else if(checkrole.rows.length > 0){
                    req.flash("error","route order already exist for this parcel, try using new order number" )
                    res.redirect(`/newroute/${track_id}`)
                    
                }else{

                    const addroute = await db.query(
                        "INSERT INTO routes (tracking_id, from_location, to_location, transit_mode,estimated_time, step_number ) VALUES ($1,$2,$3,$4,$5,$6)",
                        [track_id, from_location, to_location, mode,time, order ]
                    )
                    

                    req.flash("success", "Route successfuly added")
                    res.redirect(`/newroute/${track_id}`)
                }
               

            }catch (err) {
                console.error("route request failed: ", err.message )
                req.flash("error", "something went wrong, please try again later")
                res.redirect(`/newroute/${track_id}`)
            }
            
            
        }

})



app.get('/route', async (req, res)=>{

    try{
        const routeResult= await db.query(
            "SELECT * FROM routes ORDER BY updated_at DESC, tracking_id ASC, step_number ASC"
        )
        const routes = routeResult.rows;
        
        

        res.render('admin/routes.ejs', {routes})
    }catch (err) {
        console.error("Parcel display request failed: ", err.message)
        res.render('admin/routes.ejs', {error:"somthing went wrong during the parcel display, please try again"})

    }
})

// end of routes ========================================


// PROBLEM NAD RESOLVE CODE =======================

app.get("/newissue/:parcel_id",isAuthenticated, async(req, res)=>{
    const track_id = req.params.parcel_id
    let {route_id, notify_id, update_id} = req.query
    let info;
    let problems=[]
    let route=[]
   
    if(notify_id == undefined){
        notify_id="";
        
    }else{
        try{
            await db.query(
                "UPDATE tracking_history set notify_me = 'read' where id =$1 ",[notify_id]
            )
            
        }catch (err) {
            console.error("notification request failed", err.message)
            req.flash('error', "failed to mark as read")
            res.redirect("/login")
        }
    }
    
    try{
        if(Number(route_id)){

            const routeresult = await db.query(
                "SELECT status FROM routes where tracking_id =$1 and id = $2",[track_id, route_id]
            )
            route = routeresult.rows
            if(route.length > 0){
                info =`status: ${route[0].status}`;
                
            }else{
                info = "incorrect detail tracking_id or route id"  
            }
        }else{
            info = "incorrect detail tracking_id or route id"  

        }
                        

        const problemResult = await db.query(
            // "SELECT p.*, pa.status as parcel_status r.from_location, r.to_location, r.status as route_status FROM problem_reports p join routes r ON p.route_id = r.id join parcels pa ON p.parcel_id = pa.percel_id where r.tracking_id =$1",[track_id]
            "SELECT problem_reports.*, routes.from_location, routes.to_location , routes.status as route_status , parcels.status as parcel_status from problem_reports JOIN routes ON problem_reports.route_id = routes.id JOIN parcels ON problem_reports.parcel_id = parcels.tracking_id where parcels.tracking_id =$1 order by problem_reports.created_at ASC",[track_id]           
        )
        problems = problemResult.rows                       
        
        problems.forEach(problem => {
            problem.created_at = moment(new Date(problem.created_at)).format("Do-MMMM-YYYY, h:mm A")
            if (problem.resolved_at == undefined) {
                problem.resolve_at = "";
                
            }else{
                problem.resolved_at = moment(new Date(problem.resolved_at)).format("Do-MMMM-YYYY, h:mm A")

            }
                            
        });
        
        res.render("admin/add_issues.ejs",{track_id,route_id,problems,route,info,error:undefined}) 
        
    }catch (err){
        console.error("Fetching problem data failed: ", err); 
        res.render("admin/add_issues.ejs",{track_id,route_id,info,route,problems,error_msg:["can't fetch problem table, try again later."]})
    }

})


app.get("/update_issue/:track_id", isAuthenticated, async (req,res)=>{
    const {update_id} =req.query;
    const track_id =req.params.track_id
    

    if(update_id == undefined){

        req.flash('error',"can't fetch the problem, try again")
        return res.redirect(`/newissue/${track_id}`)


    }else{

        try{
            const problemResult = await db.query(
                "SELECT * FROM problem_reports where id = $1",[update_id]
            )
            const problem = problemResult.rows[0]
        

            res.render("admin/update_issue.ejs",{problem}) 


        }catch (err){
            console.error(err,message);
            
        }
    }
})



app.post("/update_issue/:track_id", isAuthenticated,
    [
        body("track_id","invalide tracking id, recheck the track id").exists().notEmpty().trim().escape(),
        body("route_id","invalide route id, recheck the route").exists().notEmpty().trim().escape(),
        body("reported_by","fill your name on the REPORTED BY").exists().notEmpty().trim().escape(),
        body("issue_type","issue_type is requires").exists().notEmpty().trim().escape(),
    ],
    async(req, res)=>{

    
        const {track_id, route_id,reported_by,role,issue_type,priority,description,resolution,update_id} = req.body
        const errors = validationResult(req)
        const errorAlart = []
        try{
            if(!errors.isEmpty()){
                errors.array().forEach(error => {
                    errorAlart.push(error.msg)
                });
                req.flash('error', errorAlart[0])
                return res.redirect(`/update_issue/${track_id}?update_id=${update_id}`)

            }else{
                const updateparcel = await db.query(
                    `UPDATE problem_reports set reported_by=$1,reporter_role=$2,issue_type=$3,priority=$4, description=$5, resolution_notes=$6 WHERE id =${update_id}`,
                    [reported_by,role,issue_type,priority,description,resolution]
                )

                req.flash('success', "successfuly Updated a problem report")
                return res.redirect(`/newissue/${track_id}?route_id=${route_id}`)
            }

        }catch (err){
            console.error(err);
            
            req.flash('error', "failed to Updated a problem report")
            return res.redirect(`/newissue/${track_id}?route_id=${route_id}`)
        }

})




app.post("/newissue/:parcel_id", isAuthenticated,
    [
        body("track_id","invalide tracking id, recheck the track id").exists().notEmpty().trim().escape(),
        body("route_id","invalide route id, recheck the route").exists().notEmpty().trim().escape(),
        body("reported_by","fill your name on the REPORTED BY").exists().notEmpty().trim().escape(),
        body("issue_type","issue_type is requires").exists().notEmpty().trim().escape(),
    ],
    async(req, res)=>{
    
        let problems=[]
        const {track_id, route_id,reported_by,role,issue_type,priority,description,resolution} = req.body
        const errors = validationResult(req)
        const errorAlart = []
         try{
            if(!errors.isEmpty()){
                errors.array().forEach(error => {
                    errorAlart.push(error.msg)
                });
                req.flash('error', errorAlart[0])
                return res.redirect(`/newissue/${track_id}?route_id=${route_id}`)

            }else{
                // CHECK THE PARCEL ID rout id and status in trasit or arrived
                const avalableCheck = await db.query(
                    "SELECT * FROM routes WHERE tracking_id = $1 and id = $2 and status in ('arrived', 'in transit') limit 1",
                    [track_id, route_id]
                )
                const avalable = avalableCheck.rows
                console.log(avalable);
                
                // avoiding problem duplicate
                const duplicateResult = await db.query(
                    "SELECT * FROM problem_reports WHERE parcel_id = $1 and route_id = $2 and issue_type = $3 and status = $4 limit 1",
                    [track_id, route_id, issue_type ,'open']
                )
                const duplicate = duplicateResult.rows
                

                if(avalable.length < 1){
                    req.flash('error',"can't report issues due to incorrect data or status still in pending")
                    return res.redirect(`/newissue/${track_id}?route_id=${route_id}`)
                }else if(duplicate.length > 0 ){
                    req.flash('error',"this issue hasn't been resolved yet")
                    return res.redirect(`/newissue/${track_id}?route_id=${route_id}`)
                }else{

                        const report = await db.query(
                            "INSERT INTO problem_reports (parcel_id, route_id,reported_by,reporter_role,issue_type,priority,description, resolution_notes) VALUES ($1, $2, $3, $4, $5, $6, $7,$8)",
                            [track_id, route_id,reported_by,role,issue_type,priority,description,resolution]
                        )

                        const issue = `${issue_type} - ${description}`;
                        await trackingHistory(track_id,route_id,"delayed",avalable[0].from_location, avalable[0].to_location,issue)
                        const history =generateDescription("delayed", avalable[0].from_location, avalable[0].to_location,issue)
                          
                        const updateparcel = await db.query(
                            "UPDATE parcels set status = $1 WHERE tracking_id = $2",["delayed", track_id]
                        )

                        req.flash('success', "successfuly added the report message")
                        return res.redirect(`/newissue/${track_id}?route_id=${route_id}`)

                    

                }

            }
                        
        }catch (err){
            console.error("Fetching problem data failed: ", err); 
            req.flash('error', "something went wrong, try again later")
            return res.redirect(`/newissue/${track_id}?route_id=${route_id}`)
        }
    }
)


app.get("/resolve", isAuthenticated, async(req, res)=>{
    const {resolve_id, parcel_id, status} = req.query

    try{
        const now = Date.now()
        const resolve_at = new Date(now)

        //get problem status
        const getproblem = await db.query(
            "SELECT * FROM problem_reports where id = $1 ", [resolve_id]
        )
        const problemstatus = getproblem.rows[0].status;        


        // //check for unresolved issue
        const getlocation = await db.query(
            "SELECT * FROM routes where tracking_id = $1 and status = $2 order by id desc", [parcel_id,status]
        )
        const location = getlocation.rows
        console.log(location[0].from_location);
        

// update problem status to resolved
        // const problemUpdate = await db.query(
        //     "UPDATE problem_reports set status = 'resolved', resolved_at= $1 WHERE id = $2 and parcel_id = $3 ",[resolve_at,resolve_id,parcel_id]
        // )

        if(problemstatus == "resolved"){
            req.flash("error","This issue has already been resolved" )
            return res.redirect('/newissue/'+parcel_id)

        }else{
            // update problem status to resolved
            const problemUpdate = await db.query(
                "UPDATE problem_reports set status = 'resolved', resolved_at= $1 WHERE id = $2 and parcel_id = $3 ",[resolve_at,resolve_id,parcel_id]
            )
             //check for unresolved issue
            const problemResult = await db.query(
                "SELECT * FROM problem_reports where parcel_id = $1 and status = 'open'", [parcel_id]
            )
            const problem = problemResult.rows

        
            if(problem.length > 0){            
                const issue = `issue - ${problem[0].issue_type} resolved, but parcel still have issue`

                await trackingHistory(parcel_id,location[0].id,"resolved",location[0].from_location,location[0].to_location,issue);
                const history = generateDescription("resolved",from_location=null,to_location=null,issue);
                console.log(history);

                req.flash("success","issue successfuly resolved, but parcel still have issue" )
                return res.redirect('/newissue/'+parcel_id)
                
            }else{

                const parcelUpdate = await db.query(
                    "UPDATE parcels set status = $1 WHERE tracking_id = $2",[status, parcel_id]
                )

                issue = `succefuly resoved all parcel issues`
                await trackingHistory(parcel_id,location[0].id,"resolved",location[0].from_location,location[0].to_location,issue);
            
                req.flash("success","successfuly resove parcel issues" )
                return res.redirect('/newissue/'+parcel_id)
                
            }   
        }   


    }catch (err){
        console.error("ERROR!: resolve request failed", err.message);
        req.flash("error", "resolve issue request failed")
        return res.redirect(`/newissue/${parcel_id}`)
    }


})


app.get("/arrived", isAuthenticated, async(req,res)=>{
    const {route_id, parcel_id} = req.query
    let status = "arrived"
    try {

        // checking parcel that have issues 
        const problemCheck= await db.query(
            "SELECT parcels.status as parcel_status,  problem_reports.* FROM problem_reports join parcels on problem_reports.parcel_id = parcels.tracking_id WHERE parcels.tracking_id = $1 and problem_reports.status = 'open'",[parcel_id]
        )
        const problem  = problemCheck.rows
        

        const routeResult= await db.query(
            "SELECT * FROM routes WHERE id = $1 and tracking_id = $2",[route_id, parcel_id]
        )
        routes = routeResult.rows
       
        
        
        if(routes.length < 1){
            req.flash("error", "request faild due to incorrect detail");
            return res.redirect(`/newroute/${parcel_id}`)
        }else{
            if(routes[0].status == "in transit"){

                if(problem.length > 0){
                    if(problem[0].issue_type == "late delivery" && problem.length == 1){
                        const date = new Date();
                        
                        await db.query(
                            "UPDATE problem_reports SET status = $1, resolved_at = $2 WHERE id = $3 ",["resolved", date , problem[0].id]
                        )
                         await db.query(
                             "UPDATE routes SET status = $1 WHERE id = $2 ",[status, route_id]
                         )
                         await db.query(
                             "UPDATE parcels SET status = $1 WHERE tracking_id = $2 ",[status, parcel_id]
                         )
                         await trackingHistory(parcel_id,route_id, status = "arrived", routes[0].from_location, routes[0].to_location,issue=null);

                         await checkDeliivryTime(parcel_id)

                         req.flash("success", "late delivery resolved and route status changed to arrived");
                         return res.redirect(`/newroute/${parcel_id}`)
                    }else{
                        req.flash("error", "parcel still have an unresolved issue");
                        return res.redirect(`/newroute/${parcel_id}`)
                    }
                    
                }else{
                    await db.query(
                        "UPDATE routes SET status = $1 WHERE id = $2 ",[status, route_id]
                    )
                    await db.query(
                        "UPDATE parcels SET status = $1 WHERE tracking_id = $2 ",[status, parcel_id]
                    )

                    await trackingHistory(parcel_id,route_id, status = "arrived", routes[0].from_location, routes[0].to_location,issue=null);
                    await checkDeliivryTime(parcel_id)
                    req.flash("success", " route status changed to arrived");
                    return res.redirect(`/newroute/${parcel_id}`)
                }
   
            }else{
                req.flash("error", "this parcel is not in transit");
                return res.redirect(`/newroute/${parcel_id}`)
                
            }
        }

      
        
    } catch (err) {
        console.error("arrived request failed ", err.message)
        req.flash('error', "somthing went wrong, please try again")
        return res.redirect(`/newroute/${parcel_id}`)
        
    }
})

// =====================checking delivery time===================================

async function checkDeliivryTime(parcel_id) {
    try{

        const finalRoute= await db.query(
            "SELECT * FROM routes WHERE status != $1 and tracking_id=$2",["arrived", parcel_id]
        )

        const lastroute = finalRoute.rows
        if(lastroute.length < 1){   

            await db.query(
                "UPDATE parcels SET status = $1 WHERE tracking_id = $2 ",["delivered",parcel_id]
            )
                        
        }

    }catch (err){
        console.error(err.message);
        
    }

    
}


// tracking history ======================================
app.get('/history', isAuthenticated, async(req,res)=>{

    const report = await db.query(
        "SELECT * FROM tracking_history order by id desc, tracking_id asc, created_at desc"
    )
    const reports = report.rows;

    reports.forEach(element => {
        element.created_at = moment(new Date(element.created_at)).format("Do-MMMM-YYYY, h:mm A")

        
    });

    res.render("admin/history.ejs", {reports})
})

// tracking history ======================================

app.get('/report', isAuthenticated, async(req,res)=>{

    const report = await db.query(
        "SELECT * FROM tracking_history order by id desc, tracking_id asc, created_at desc"
    )
    const reports = report.rows;

    reports.forEach(element => {
        element.created_at = moment(new Date(element.created_at)).format("Do-MMMM-YYYY, h:mm A")

        
    });

    res.render("admin/reports.ejs", {reports})
})

// tracking


// app.get('/tracking', async(req,res)=>{
//     let reports = []
//     res.render("client-side/tracking.ejs", {reports})
    


// })

app.get('/tracking', async(req,res)=>{
    let {track_id} = req.query
    let reports = []

    if(track_id == undefined){
        res.render("client-side/tracking.ejs", {reports})


    }else{
        try{
                    
            const problemResult = await db.query(
                "SELECT * FROM problem_reports WHERE parcel_id=$1  order by id asc",[track_id]

            )
            const problem = problemResult.rows    
            // console.log(problem[0].issue_type);
                  
            
            const parcelResult = await db.query(
                "SELECT * FROM parcels WHERE tracking_id=$1 order by id asc",[track_id]
            )
            let parcel = parcelResult.rows 

            if(parcel.length > 0){
                if(parcel[0].is_active == 'true'){
                    
                    const trackResult = await db.query(
                        "SELECT tracking_history.*, parcels.expected_arrival_time FROM tracking_history join parcels on tracking_history.tracking_id = parcels.tracking_id  where tracking_history.tracking_id = $1 order by id asc ",[track_id]
                    )
                    const reports = trackResult.rows
                    
                    let x = 0
                    reports.forEach(element => {
                        element.created_at = moment(new Date(element.created_at)).format("Do-MMMM-YYYY, h:mm A") 
                        if(element.expected_arrival_time == null){
                            element.expected_arrival_time =""                            
                        }else{
                            element.expected_arrival_time = moment(new Date(element.expected_arrival_time)).format("Do-MMMM-YYYY, h:mm A")   
                        }
                        
                        if(element.status == "delayed" || element.status == "resolved"){
                            if(!problem[x]){
                                element.issue_type = ""
                                element.resolution = ""
                            }else{   
                            //  console.log (problem[x].status + "=>" +element.status)
                                element.issue_type = `${problem[x].issue_type}`,
                                element.resolution = problem[0].resolution_notes
                                x++
                            }
                        }
                    });
                    res.render("client-side/tracking.ejs", {reports})
                

                }else{
                    req.flash('error', "parcel details can't be provided, please try again later")
                    return res.redirect(`/tracking}`)
                }
            }else{
                req.flash('error', "parcel not found")
                return res.redirect(`/tracking`)
            }
            
        }catch (err){
            console.error("tracking reqest failed to fetch ", err.message);
            return res.redirect(`/tracking`)     
        }
    }
})

function generateDescription(status,from_location,to_location, issue=null) {
    const time = new Date().toLocaleString()
    switch (status) {
        case "processing":
            return `parcel registerd, processing to start shipment`;         

        case "in transit":
            return `parcel is now in transit from ${from_location} to ${to_location}`;           
    
        case "delayed":
            return `Delivery delay!!! ${issue}. route (from ${from_location} to ${to_location})`;           
    
        case "open":
            return `Delivery delay to ${issue}. reported at ${from_location} to ${to_location}`;           

        case "resolved":
            return `${issue}`;           

        case "arrived":
            return `parcel has arrived from ${from_location} to ${to_location}. Awaiting for next dispatch or final delivery`;           
    
        case "delivered":
            return `parcel has successfully arrived at its final destination: ${to_location}`;           

        case "arrived late":
            return `system dictates that this parcel has missed the expected arrival time. please we will get back to you.`;       
    
        default:
            return `parcel update ${status} on ${time}`;
    }
}

async function trackingHistory(tracking_id, route_id, status, from_location, to_location, issue=null) {
    const description  = generateDescription(status,from_location,to_location,issue)
    let current_location = `${from_location} to ${to_location}`

    if(status == "processing"){
        current_location = "warehouse";
    }

    await db.query(
        "INSERT INTO tracking_history (tracking_id, route_id, status, current_location, description) VALUES ($1, $2, $3, $4, $5)",
        [tracking_id, route_id, status, current_location,description]
    )
    
}




// listening to server calls
const port = process.env.PORT || 3000
app.listen(port, ()=>{
    console.log("project currently running on port ",port);
    
})