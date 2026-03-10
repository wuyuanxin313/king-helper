import React from 'react';
import { Todo, Priority } from '../types/todo';
import './TodoItem.css';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const dateMid = new Date(date);
    const nowMid = new Date(now);
    dateMid.setHours(0, 0, 0, 0);
    nowMid.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dateMid.getTime() - nowMid.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays === -1) return '昨天';
    if (diffDays > 0 && diffDays <= 7) return `${diffDays}天后`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}天前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getPriorityLabel = (priority?: Priority) => {
    if (!priority) return null;
    const labels = {
      low: '低',
      medium: '中',
      high: '高',
    };
    return labels[priority];
  };

  const getPriorityClass = (priority?: Priority) => {
    if (!priority) return '';
    return `priority-${priority}`;
  };

  return (
    <div 
      className={`todo-item ${todo.completed ? 'completed' : ''}`}
      onClick={() => onToggle(todo.id)}
      style={{ cursor: 'pointer' }}
    >
      <div className="todo-item-content">
        <label className="todo-checkbox">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggle(todo.id)}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="checkmark"></span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <span className="todo-title">{todo.title}</span>
          {todo.priority && (
            <span className={`todo-priority ${getPriorityClass(todo.priority)}`}>
              {getPriorityLabel(todo.priority)}
            </span>
          )}
        </div>
      </div>
      <div className="todo-item-actions">
        {todo.dueDate && (
          <span className="todo-due-date">{formatDate(todo.dueDate)}</span>
        )}
        {todo.dueTime && (
          <span className="todo-due-date">⏰ {todo.dueTime}</span>
        )}
        <button
          className="todo-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(todo.id);
          }}
          title="删除"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default TodoItem;

