import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectLoading from '../../src/app/app/project/loading';
import HomeLoading from '../../src/app/app/home/loading';
import HomeError from '../../src/app/app/home/error';
import TasksLoading from '../../src/app/app/tasks/loading';
import AnalyticsLoading from '../../src/app/app/analytics/loading';
import AnalyticsError from '../../src/app/app/analytics/error';
import ToolsLoading from '../../src/app/app/tools/loading';
import FilesLoading from '../../src/app/app/files/loading';
import FilesError from '../../src/app/app/files/error';

// Actual components with explicit local inputs. This is not a Next segment
// fault/retry test, a server read, or an authenticated production session.
const components = {
  'tasks.state.app-project-loading': ProjectLoading,
  'tasks.state.app-home-loading': HomeLoading,
  'tasks.state.app-home-error': HomeError,
  'tasks.state.app-tasks-loading': TasksLoading,
  'tasks.state.app-analytics-loading': AnalyticsLoading,
  'tasks.state.app-analytics-error': AnalyticsError,
  'tasks.state.app-tools-loading': ToolsLoading,
  'tasks.state.app-files-loading': FilesLoading,
  'tasks.state.app-files-error': FilesError,
};
const id = location.pathname.slice('/materiality/'.length);
const Component = components[id];
if (!Component) throw Error('Undeclared materiality component');
const error = new Error('Synthetic materiality failure: ' + id);
error.digest = 'synthetic-materiality';
window.__materiality = { id, retryCount: 0, scope: 'actual component; local callback only' };
const retry = () => { window.__materiality.retryCount += 1; };
createRoot(document.getElementById('root')).render(<Component error={error} reset={retry} retry={retry} />);
