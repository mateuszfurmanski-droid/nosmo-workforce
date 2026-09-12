import pg from "pg";
import {isProduction,productionDatabaseUrl,productionSslOptions,redactedLogValue} from "./security-core.js";

export function installSecurePgPool(){
  if(pg.__nosmoSecurePoolInstalled)return;
  const OriginalPool=pg.Pool;
  if(typeof OriginalPool!=="function")throw new Error("NOSMO_PG_POOL_UNAVAILABLE");
  class NosmoSecurePool extends OriginalPool{
    constructor(config={}){
      const next={...config};
      if(isProduction()){
        next.connectionString=productionDatabaseUrl(next.connectionString);
        next.ssl=productionSslOptions();
      }
      super(next);
    }
  }
  Object.defineProperty(pg,"Pool",{value:NosmoSecurePool,writable:false,configurable:false,enumerable:true});
  Object.defineProperty(pg,"__nosmoSecurePoolInstalled",{value:true,writable:false,configurable:false});
}

export function installRedactedErrorLogger(){
  if(!isProduction()||console.__nosmoRedactedErrorLogger)return;
  const original=console.error.bind(console);
  console.error=(...args)=>original(...args.map(redactedLogValue));
  Object.defineProperty(console,"__nosmoRedactedErrorLogger",{value:true,writable:false,configurable:false});
}

installSecurePgPool();
installRedactedErrorLogger();
