import React, { useState, useEffect } from 'react';
import './MainWindow.css';
import AddTodoForm from './components/AddTodoForm';
import PreviewView from './components/PreviewView';
import { Todo } from './types/todo';

interface MainWindowProps {
  onPinToDesktop: () => void;
}

const MainWindow: React.FC<MainWindowProps> = ({ onPinToDesktop }) => {
  const handlePinClick = () => {
    onPinToDesktop();
  };
  const [activeTab, setActiveTab] = useState<'add' | 'today' | 'preview' | null>(null);
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const saved = localStorage.getItem('todos');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Failed to load todos from localStorage:', error);
      return [];
    }
  });

  // 保存到本地存储
  useEffect(() => {
    try {
      localStorage.setItem('todos', JSON.stringify(todos));
    } catch (error) {
      console.warn('Failed to save todos to localStorage:', error);
    }
  }, [todos]);

  // 监听本地存储变化（实现多窗口同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'todos') {
        try {
          const newTodos = e.newValue ? JSON.parse(e.newValue) : [];
          setTodos(newTodos);
        } catch (error) {
          console.warn('Failed to parse todos from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
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

  return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleAddTodo = (todoData: Omit<Todo, 'id' | 'completed' | 'createdAt'>) => {
    const newTodo: Todo = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      ...todoData,
      completed: false,
      createdAt: Date.now(),
    };
    setTodos((prev) => [...prev, newTodo]);
    // 添加成功后可以切换到今日视图
    // setActiveTab('today');
    try {
      window.dispatchEvent(
        new CustomEvent('app:toast', { detail: { message: '添加成功' } })
      );
    } catch {}
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo: Todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueTime, setEditDueTime] = useState('');
  const [editPriority, setEditPriority] = useState<string>('');

  const openEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setEditTitle(todo.title);
    setEditPriority(todo.priority || '');
    if (todo.dueDate) {
      const d = new Date(todo.dueDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setEditDueDate(`${y}-${m}-${day}`);
    } else {
      setEditDueDate('');
    }
    setEditDueTime(todo.dueTime || '');
  };

  const closeEdit = () => {
    setEditingTodo(null);
    setEditTitle('');
    setEditDueDate('');
    setEditDueTime('');
    setEditPriority('');
  };

  const saveEdit = () => {
    if (!editingTodo) return;
    const updated = todos.map((t) =>
      t.id === editingTodo.id
        ? {
            ...t,
            title: editTitle.trim() || t.title,
            dueDate: (() => {
              if (!editDueDate) return undefined;
              const d = new Date(editDueDate);
              if (editDueTime) {
                const [hh, mm] = editDueTime.split(':');
                d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
              } else {
                d.setHours(0, 0, 0, 0);
              }
              return d.getTime();
            })(),
            dueTime: (editDueTime || undefined) as any,
            priority: (editPriority || undefined) as any,
          }
        : t
    );
    setTodos(updated);
    try {
      window.dispatchEvent(
        new CustomEvent('app:toast', { detail: { message: '修改成功' } })
      );
    } catch {}
    closeEdit();
  };

  // 获取今日任务
  const getTodayTodos = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    return todos.filter((todo) => {
      if (!todo.dueDate) return false;
      return todo.dueDate >= todayStart && todo.dueDate < todayEnd;
    });
  };

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

  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const onToast = (e: any) => {
      const msg = e?.detail?.message || '';
      if (!msg) return;
      setToastMsg(msg);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1800);
    };
    window.addEventListener('app:toast', onToast as EventListener);
    return () => window.removeEventListener('app:toast', onToast as EventListener);
  }, []);

  const dev = typeof window !== 'undefined' && /^https?/.test(window.location.protocol);
  const baseUrl = (import.meta as any)?.env?.BASE_URL || '/';
  const welcomeCandidates = dev
    ? [
        baseUrl + 'welcome.gif',
        baseUrl + 'welcome-gif.gif',
        '/welcome.gif',
        '/welcome-gif.gif',
        'welcome.gif',
        './welcome.gif',
      ]
    : [
        baseUrl + 'welcome.gif',
        baseUrl + 'welcome-gif.gif',
        'welcome.gif',
        './welcome.gif',
        new URL('../welcome.gif', window.location.href).href,
        new URL('../welcome-gif.gif', window.location.href).href,
        new URL('../../public/welcome.gif', window.location.href).href,
        new URL('../../public/welcome-gif.gif', window.location.href).href,
      ];
  const [welcomeIdx, setWelcomeIdx] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const welcomeSrc = welcomeCandidates[welcomeIdx];
  useEffect(() => {
    console.log('welcome dev:', dev, 'candidate:', welcomeSrc);
  }, [dev, welcomeSrc]);

  return (
    <div className="main-window">
      {/* 顶部工具栏 */}
      <div className="main-header">
        <h1 className="main-title">小金助手</h1>
        <button className="pin-desktop-btn" onClick={handlePinClick}>
          📌 固定小窗口
        </button>
      </div>

      <div className="main-content">
        {/* 左侧导航栏 */}
        <div className="sidebar">
          <button
            className={`sidebar-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            ➕ 添加待办
          </button>
          <button
            className={`sidebar-btn ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            📅 今日
          </button>
          <button
            className={`sidebar-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            👁️ 预览
          </button>
        </div>

        {/* 主内容区 */}
        <div className="content-area">
          {activeTab === null && (
            <div className="welcome-content">
              {showEmoji ? (
                <div className="welcome-emoji">✨</div>
              ) : (
                <img
                  src={welcomeSrc}
                  alt="welcome"
                  className="welcome-image"
                  onLoad={() => {
                    console.log('welcome loaded:', welcomeSrc);
                  }}
                  onError={() => {
                    console.warn('welcome failed:', welcomeSrc);
                    if (welcomeIdx < welcomeCandidates.length - 1) {
                      setWelcomeIdx(welcomeIdx + 1);
                    } else {
                      setShowEmoji(true);
                    }
                  }}
                />
              )}
              <div className="welcome-greeting">欢迎使用小金助手</div>
              <div className="welcome-subtitle">让待办事项始终在您的视线中</div>
            </div>
          )}

          {activeTab === 'add' && (
            <div className="tab-content">
              <h2>添加待办</h2>
              <AddTodoForm onAdd={handleAddTodo} />
            </div>
          )}

          {activeTab === 'today' && (
            <div className="tab-content">
              <h2>今日任务</h2>
              {getTodayTodos().length === 0 ? (
                <div className="preview-empty">
                  <div className="empty-emoji">📅</div>
                  <p>今天还没有待办事项</p>
                  <p className="empty-hint">在"添加待办"中创建您的第一个待办事项</p>
                </div>
              ) : (
                <div className="todos-list" style={{ marginTop: '20px' }}>
                  {getTodayTodos().map((todo) => (
                    <div
                      key={todo.id}
                      className={`preview-todo-item ${todo.completed ? 'completed' : ''}`}
                      onClick={() => toggleTodo(todo.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="todo-checkbox-preview">
                        <div className={`checkbox-circle ${todo.completed ? 'checked' : ''}`}>
                          {todo.completed && '✓'}
                        </div>
                      </div>
                      <div className="todo-content-preview">
                        <div className="todo-title-preview">{todo.title}</div>
                        <div className="todo-meta">
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
                      <button
                        className="todo-edit-btn-preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(todo);
                        }}
                        title="编辑"
                      >
                        ✎
                      </button>
                      <button
                        className="todo-delete-btn-preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTodo(todo.id);
                        }}
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="tab-content preview-tab-content">
              <PreviewView
                todos={todos}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onEdit={(todo) => openEdit(todo)}
              />
            </div>
          )}
        </div>
      </div>
      {editingTodo && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <div className="edit-modal-header">
              <div className="edit-modal-title">编辑待办</div>
              <button className="edit-close-btn" onClick={closeEdit}>×</button>
            </div>
            <div className="edit-modal-body">
              <div className="form-group">
                <label className="form-label">事件</label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">日期</label>
                <input
                  type="date"
                  className="form-input"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">具体时间</label>
                <input
                  type="time"
                  className="form-input"
                  value={editDueTime}
                  step="60"
                  onChange={(e) => setEditDueTime(e.target.value ? e.target.value.slice(0, 5) : '')}
                  placeholder="例如 19:00"
                />
              </div>
              <div className="form-group">
                <label className="form-label">优先级</label>
                <select
                  className="form-select"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                >
                  <option value="">无</option>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
            </div>
            <div className="edit-modal-footer">
              <button className="pin-desktop-btn" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
      {toastVisible && <div className="app-toast">{toastMsg}</div>}
    </div>
  );
};

export default MainWindow;
