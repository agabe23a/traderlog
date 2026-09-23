const {Pool}=require('pg');
const connectionString=process.env.DATABASE_URL;
const sslEnabled=String(process.env.DB_SSL||'false').toLowerCase()==='true';
const config={max:Number(process.env.DB_POOL_MAX||10),idleTimeoutMillis:30000,connectionTimeoutMillis:10000,keepAlive:true};
if(connectionString)config.connectionString=connectionString;else{config.host=process.env.DB_HOST||'127.0.0.1';config.port=Number(process.env.DB_PORT||5432);config.database=process.env.DB_NAME||'traderslog';config.user=process.env.DB_USER;config.password=process.env.DB_PASSWORD;}
if (sslEnabled) config.ssl = { rejectUnauthorized: false };
if(!config.user && !connectionString && process.env.NODE_ENV==='production')throw new Error('Set DATABASE_URL or DB_USER/DB_PASSWORD in production.');
const pool=new Pool(config);
pool.on('error',err=>console.error('[db] idle client error:',err.message));
async function healthCheck(){const started=Date.now();await pool.query('SELECT 1');return {ok:true,latency_ms:Date.now()-started};}
module.exports={pool,query:(text,params)=>pool.query(text,params),getClient:()=>pool.connect(),healthCheck};
