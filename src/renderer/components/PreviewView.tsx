import React, { useState, useEffect } from 'react';
import { Todo } from '../types/todo';
import './PreviewView.css';

interface PreviewViewProps {
  todos: Todo[];
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (todo: Todo) => void;
}

const PreviewView: React.FC<PreviewViewProps> = ({ todos, onToggle, onDelete, onEdit }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => new Date().getFullYear());

  useEffect(() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() !== selectedDate.getTime()) {
      setSelectedDate(d);
    }
  }, []);

  const changeWeek = (offset: number) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + offset * 7);
    setWeekStart(newStart);
  };

  const openPicker = () => {
    setPickerYear(weekStart.getFullYear());
    setPickerVisible(true);
  };

  const changePickerYear = (delta: number) => {
    setPickerYear((y) => y + delta);
  };

  const applyMonth = (monthIndex: number) => {
    const firstDay = new Date(pickerYear, monthIndex, 1);
    firstDay.setHours(0, 0, 0, 0);
    const d = new Date(firstDay);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    setWeekStart(d);
    setSelectedDate(firstDay);
    setPickerVisible(false);
  };

  const getWeekDays = () => {
    const days = [];
    const current = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const getDayLabel = (dayIndex: number) => {
    const labels = ['日', '一', '二', '三', '四', '五', '六'];
    return labels[dayIndex];
  };

  const weekDays = getWeekDays();
  const currentMonthYear = `${weekStart.getMonth() + 1}月 ${weekStart.getFullYear()}`;

  const filteredTodos = todos.filter(todo => {
    if (!todo.dueDate) return false;
    const todoDate = new Date(todo.dueDate);
    return isSameDay(todoDate, selectedDate);
  });

  const getPriorityLabel = (priority?: string) => {
    if (!priority) return null;
    const labels: { [key: string]: string } = {
      low: '低',
      medium: '中',
      high: '高',
    };
    return labels[priority];
  };

  const getPriorityClass = (priority?: string) => {
    if (!priority) return '';
    return `priority-${priority}`;
  };

  return (
    <div className="preview-view">
      <h2 className="preview-title">预览</h2>
      
      <div className="calendar-container">
        <div className="calendar-header">
          <div className="month-year-display" onClick={openPicker}>
            {currentMonthYear} <span className="dropdown-arrow">∨</span>
          </div>
          <div className="week-navigation">
            <button className="nav-btn" onClick={() => changeWeek(-1)}>&lt;</button>
            <button className="nav-btn" onClick={() => changeWeek(1)}>&gt;</button>
          </div>
        </div>
        {pickerVisible && (
          <div className="month-picker">
            <div className="month-picker-header">
              <button className="picker-nav" onClick={() => changePickerYear(-1)}>&lt;</button>
              <div className="picker-year">{pickerYear}年</div>
              <button className="picker-nav" onClick={() => changePickerYear(1)}>&gt;</button>
            </div>
            <div className="month-grid">
              {Array.from({ length: 12 }).map((_, idx) => {
                const isCurrent = (idx === weekStart.getMonth()) && (pickerYear === weekStart.getFullYear());
                return (
                  <div
                    key={idx}
                    className={`month-cell ${isCurrent ? 'selected' : ''}`}
                    onClick={() => applyMonth(idx)}
                  >
                    {idx + 1}月
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="calendar-week-strip">
          {weekDays.map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            return (
              <div 
                key={index} 
                className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <div className="day-label">{getDayLabel(date.getDay())}</div>
                <div className="day-number">{date.getDate()}</div>
                {isSelected && <div className="day-indicator"></div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="todo-section">
        <h3 className="section-title">待办清单</h3>
        {filteredTodos.length === 0 ? (
          <div className="preview-empty-simple">
            <p>当天没有待办事项</p>
          </div>
        ) : (
          <div className="todos-list">
            {filteredTodos.map((todo) => (
              <div
                key={todo.id}
                className={`preview-todo-item ${todo.completed ? 'completed' : ''}`}
                onClick={() => onToggle && onToggle(todo.id)}
                style={{ cursor: onToggle ? 'pointer' : 'default' }}
              >
                <div className="todo-checkbox-preview">
                  <div className={`checkbox-circle ${todo.completed ? 'checked' : ''}`}>
                    {todo.completed && '✓'}
                  </div>
                </div>
                <div className="todo-content-preview">
                  <div className="todo-title-preview">{todo.title}</div>
                  <div className="todo-meta">
                    <span className="todo-date-label">📅 {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日</span>
                    {todo.dueTime && (
                      <span className="todo-date-label">⏰ {todo.dueTime}</span>
                    )}
                    {todo.priority && (
                      <span className={`priority-badge ${getPriorityClass(todo.priority)}`}>
                        {getPriorityLabel(todo.priority)}
                      </span>
                    )}
                  </div>
                </div>
                {onEdit && (
                  <button
                    className="todo-edit-btn-preview"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(todo);
                    }}
                    title="编辑"
                  >
                    ✎
                  </button>
                )}
                {onDelete && (
                  <button
                    className="todo-delete-btn-preview"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(todo.id);
                    }}
                    title="删除"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewView;
