export const registry=new Map();
export function registerTool(tool){registry.set(tool.name,tool);}
export function getTool(name){return registry.get(name);}
export function listTools(){return [...registry.values()].map(t=>({name:t.name,description:t.description}));}
