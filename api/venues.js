import {getVenues} from '../lib/venues.js';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 const data=await getVenues();res.setHeader('Cache-Control','public, s-maxage=60, max-age=0');return res.status(200).json(data);
}
