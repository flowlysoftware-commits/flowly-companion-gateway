import {registerTool} from './toolRegistry.js';
registerTool({
 name:'flowly.status',
 description:'Returns Flowly gateway status.',
 async execute(){
   return {ok:true,status:'online',time:new Date().toISOString()};
 }
});
