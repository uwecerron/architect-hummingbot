import {createServer} from 'node:http';
import {createServer as createVite} from 'vite';
import handler from '../../api/market.js';
try{process.loadEnvFile('.env.local');}catch{}
const vite=await createVite({server:{middlewareMode:true},appType:'spa'});
const server=createServer(async(req,res)=>{
  if(req.url?.split('?')[0]==='/api/market'){
    res.status=(n)=>{res.statusCode=n;return res;};res.json=(v)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};await handler(req,res);
  }else vite.middlewares(req,res);
});
server.listen(4180,'127.0.0.1',()=>console.log('Compute / Energy Lab: http://127.0.0.1:4180'));
