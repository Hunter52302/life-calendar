import { createOAuthRouter } from './oauthProvider.js';
import * as microsoft from '../lib/oauth/microsoft.js';

export default createOAuthRouter(microsoft);
