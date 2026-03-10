import React from 'react';
import './WindowControls.css';

interface WindowControlsProps {
  isPinned: boolean;
  onTogglePin: () => void;
}

const WindowControls: React.FC<WindowControlsProps> = ({
  isPinned,
  onTogglePin,
}) => {
  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow().catch((err: Error) => {
        console.warn('Failed to minimize window:', err);
      });
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow().catch((err: Error) => {
        console.warn('Failed to close window:', err);
      });
    }
  };

  return (
    <div className="window-controls">
      <div className="window-controls-left">
        <button
          className={`control-btn pin-btn ${isPinned ? 'active' : ''}`}
          onClick={onTogglePin}
          title={isPinned ? '取消置顶' : '置顶'}
        >
          📌
        </button>
      </div>
      <div className="window-controls-right">
        <button
          className="control-btn minimize-btn"
          onClick={handleMinimize}
          title="最小化"
        >
          −
        </button>
        <button
          className="control-btn close-btn"
          onClick={handleClose}
          title="关闭"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default WindowControls;

