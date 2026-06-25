import { createOAuthRouter } from './oauthProvider.js';
import * as google from '../lib/oauth/google.js';

export default createOAuthRouter(google);
