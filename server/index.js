import express from "express";
import { aiDetector,initializeDatacenterRanges } from "./middleware/botdetecter.js";

const app=express();
await initializeDatacenterRanges()
app.use(aiDetector)

app.get("/articles/test",(req,res)=>{
    const {isBot,botname,score,signals}=req.botDetection;
    if (isBot) {
        return res.status(402).json({
        error:"Payment required",
        score,
        botname,
        signals,
    });
    }
    res.json({content:"here is your article ",signals,score})
});

app.get("/health",(req,res)=>{
    res.json({
        status:"ok"
    })
})
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});