import {createServer} from 'node:http';
import {createServer as createVite} from 'vite';
import handler from '../../api/market.js';
import surfaceHandler from '../../api/surface.js';
import venuesHandler from '../../api/venues.js';
import lighterHandler from '../../api/lighter.js';
try{process.loadEnvFile('.env.local');}catch{}
const vite=await createVite({server:{middlewareMode:true},appType:'spa'});
const server=createServer(async(req,res)=>{
  if(['/api/market','/api/lighter','/api/venues','/api/surface'].includes(req.url?.split('?')[0])){
    res.status=(n)=>{res.statusCode=n;return res;};res.json=(v)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};await (req.url.split('?')[0]==='/api/surface'?surfaceHandler:req.url.split('?')[0]==='/api/venues'?venuesHandler:req.url.split('?')[0]==='/api/lighter'?lighterHandler:handler)(req,res);
  }else vite.middlewares(req,res);
});
server.listen(4180,'127.0.0.1',()=>console.log('Compute / Energy Lab: http://127.0.0.1:4180'));
