function generateTrackingId() {
    const num = Math.round(Math.random()*9999)
    const alphnum = Math.random().toString(20).slice(2,12).toUpperCase()
    const trackid = `TRKID${num}${alphnum}`;
    return trackid
    
}

const trackingId = generateTrackingId()

console.log( trackingId);
