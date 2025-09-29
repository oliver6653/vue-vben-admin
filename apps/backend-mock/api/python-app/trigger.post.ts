import { defineEventHandler } from 'h3';
import { setupAndRunPythonAppAsync } from '~/utils/python-app-manager';

export default defineEventHandler(async () => {
  try {
    setupAndRunPythonAppAsync();
    return {
      success: true,
      message: 'Python app setup and run triggered asynchronously',
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
});
