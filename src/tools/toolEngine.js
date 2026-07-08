import './flowlyTools.js';
import {getTool,listTools} from './toolRegistry.js';
export async function executeTool(name,args={}){
 const t=getTool(name);
 if(!t) return {ok:false,error:'Unknown tool'};
 return t.execute(args);
}
export {listTools};
