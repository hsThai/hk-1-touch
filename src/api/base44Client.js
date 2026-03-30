import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId: "69c952d2d6929b0265367989",
  token,
  functionsVersion,
  requiresAuth: false,
  appBaseUrl
});