const fs = require("fs");

async function buildString() {
  const host = "_mongodb._tcp.cluster0.6yn9arg.mongodb.net";
  try {
    const srvRes = await fetch(`https://dns.google/resolve?name=${host}&type=SRV`);
    const srvData = await srvRes.json();
    
    if (!srvData.Answer) throw new Error("No SRV answers found");
    const nodes = srvData.Answer.map(ans => {
      const parts = ans.data.split(" ");
      const target = parts[3].replace(/\.$/, ""); 
      return `${target}:${parts[2]}`;
    }).join(",");

    const txtRes = await fetch(`https://dns.google/resolve?name=cluster0.6yn9arg.mongodb.net&type=TXT`);
    const txtData = await txtRes.json();
    
    let replicaSet = "atlas-xxxxx-shard-0";
    if (txtData.Answer) {
      const txtStr = txtData.Answer.map(ans => ans.data).join("");
      const match = txtStr.match(/authSource=admin&replicaSet=([^&"]+)/);
      if (match) replicaSet = match[1];
    }

    const uri = `mongodb://aryan407012_db_user:lNFiPsNgwTg7ymYC@${nodes}/chatappdb?ssl=true&replicaSet=${replicaSet}&authSource=admin&retryWrites=true&w=majority`;
    
    let env = fs.readFileSync(".env", "utf8");
    env = env.replace(/MONGO_URI=.*/g, `MONGO_URI=${uri}`);
    fs.writeFileSync(".env", env);
    
    console.log("SUCCESSFULLY UPDATED .ENV WITH BYPASS URI!");
  } catch(e) {
    console.error("DNS over HTTPS Error:", e);
  }
}
buildString();
