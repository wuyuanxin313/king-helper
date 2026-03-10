import React from 'react';
import MainWindow from './MainWindow';
import App from './App';

const handlePinToDesktop = () => {
  if (window.electronAPI) {
    window.electronAPI.createTodoWindow().catch((err: Error) => {
      console.warn('Failed to create todo window:', err);
    });
  }
};

// 根据 URL hash 或路径决定显示哪个组件
const Router: React.FC = () => {
  // 检查 URL hash 或路径
  const hash = window.location.hash;
  const pathname = window.location.pathname;

  // 如果是 /todo 路径或 #todo hash，显示待办清单
  if (pathname.includes('/todo') || hash === '#todo') {
    return <App />;
  }

  // 默认显示主窗口
  return <MainWindow onPinToDesktop={handlePinToDesktop} />;
};

export default Router;
