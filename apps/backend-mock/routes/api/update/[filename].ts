import { defineEventHandler } from 'h3';

import updateHandler from '../../../api/update';

export default defineEventHandler((event) => {
  // Delegate to the update handler
  return updateHandler(event);
});
