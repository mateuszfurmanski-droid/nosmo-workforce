const originalVercel=process.env.VERCEL;
process.env.VERCEL="1";
const {default:app}=await import("./security-entry.js");
if(originalVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=originalVercel;

const port=Number(process.env.PORT||4178);
app.listen(port,"0.0.0.0",()=>console.log(`NOSMO Agency secured runtime listening on :${port}`));
