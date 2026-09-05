import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/browser',
  timeout:30000,
  retries:0,
  reporter:'line',
  use:{
    baseURL:'http://127.0.0.1:4179',
    trace:'retain-on-failure'
  },
  projects:[
    {name:'phone-narrow',use:{...devices['Galaxy S9+'],viewport:{width:360,height:780}}},
    {name:'fold-wide',use:{viewport:{width:690,height:840},deviceScaleFactor:1,isMobile:true,hasTouch:true}},
    {name:'desktop',use:{viewport:{width:1280,height:900}}}
  ]
});
