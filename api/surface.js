import {getSurface} from '../lib/surface.js';
export default async function handler(req,res){if(req.method!=='GET')return res.status(405).json({error:'GET only'});res.setHeader('Cache-Control','public, s-maxage=30, max-age=0');return res.status(200).json(await getSurface());}
