import { loadRootEnvironment } from './root-environment.mjs';
import nextEnv from '@next/env';

// Run before application imports create database clients or provider adapters.
loadRootEnvironment();
// Mark configuration processed before Next captures public variables or forks
// build workers. Filtering in next.config alone happens too late for those paths.
nextEnv.processEnv([], process.cwd(), console, true);
nextEnv.updateInitialEnv(process.env);
