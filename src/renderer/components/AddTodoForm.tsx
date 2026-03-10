import React, { useState } from 'react';
import { Todo, Priority } from '../types/todo';
import './AddTodoForm.css';
import SmartInputModal from './SmartInputModal';

interface AddTodoFormProps {
  onAdd: (todo: Omit<Todo, 'id' | 'completed' | 'createdAt'>) => void;
}

const AddTodoForm: React.FC<AddTodoFormProps> = ({ onAdd }) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    // 默认时间为今天
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [priority, setPriority] = useState<Priority | ''>('');
  const [showSmart, setShowSmart] = useState(false);
  const [dueTime, setDueTime] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('事件不能为空');
      return;
    }

    let dueTs = dueDate ? new Date(dueDate) : undefined;
    if (dueTs && dueTime) {
      const [hh, mm] = dueTime.split(':');
      dueTs.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    } else if (dueTs) {
      dueTs.setHours(0, 0, 0, 0);
    }
    const newTodo: Omit<Todo, 'id' | 'completed' | 'createdAt'> = {
      title: title.trim(),
      dueDate: dueTs ? dueTs.getTime() : undefined,
      dueTime: dueTime || undefined,
      priority: priority || undefined,
    };

    onAdd(newTodo);
    
    // 重置表单
    setTitle('');
    setDueDate(() => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });
    setPriority('');
    setDueTime('');
  };

  return (
    <form className="add-todo-form" onSubmit={handleSubmit}>
      <div className="smart-trigger-wrap">
        <button
          type="button"
          className="smart-trigger-btn"
          onClick={() => setShowSmart(true)}
          title="智能创建任务"
        >
          💡
        </button>
        <div className="smart-tooltip">告诉我你要做的所有事，我帮你一键安排！</div>
      </div>
      <div className="form-group">
        <label className="form-label">
          事件 <span className="required">*</span>
        </label>
        <input
          type="text"
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="请输入待办事件"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">日期</label>
        <input
          type="date"
          className="form-input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">具体时间</label>
        <input
          type="time"
          className="form-input"
          value={dueTime}
          step="60"
          onChange={(e) => setDueTime(e.target.value ? e.target.value.slice(0, 5) : '')}
          placeholder="例如 19:00"
        />
      </div>

      <div className="form-group">
        <label className="form-label">优先级</label>
        <select
          className="form-select"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | '')}
        >
          <option value="">无</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
      </div>

      <button type="submit" className="submit-btn">
        添加待办
      </button>
      {showSmart && (
        <SmartInputModal
          onClose={() => setShowSmart(false)}
          onCreate={(items) => {
            items.forEach((it) => onAdd(it));
          }}
        />
      )}
    </form>
  );
};

export default AddTodoForm;
