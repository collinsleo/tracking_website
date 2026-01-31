const nodemailer = require('nodemailer');
require('dotenv').config();


const transporter =  nodemailer.createTransport({
    service : 'gmail',
    auth:{
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }

});

const sendMail = async({to, subject, html})=>{
    try{
        const info = await transporter.sendMail({
            from: `"FireFoxExprex Logistics" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        return true;
    }catch(error){
        console.error("email not sent: "+ error.message)
        return false;
    }
}


// const templatePath = path.join(__dirname, '../views/emails/new_user.html');
// const template = fs.readFileSync(templatePath, 'utf-8');
// const html = ejs.render(template, {
//     username: username,
// });

module.exports = sendMail;