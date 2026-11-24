import * as live from './api.supabase.js';
import * as demo from './api.demo.js';

export const isDemo = !live.isConfigured;
export const api = isDemo ? demo.api : live.api;
