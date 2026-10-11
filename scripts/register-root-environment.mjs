import { loadRootEnvironment } from './root-environment.mjs';

// Run before application imports create database clients or provider adapters.
loadRootEnvironment();
