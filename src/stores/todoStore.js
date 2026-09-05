// ========== Todo Store（待办数据，走 settings.todosData 同步） ==========

import { defineStore } from 'pinia'
import { TODO_KEY } from '../utils/constants'
import { cloudFetch } from '../api/supabase'
import { uid } from '../utils/business'

export const useTodoStore = defineStore('todo', {
  state: () => ({
    todos: []
  }),

  getters: {
    // 本人未完成（提醒弹窗用）
    myTodos(state) {
      // currentUser 需从 userStore 传入，这里只做过滤框架
      return state.todos
    }
  },

  actions: {
    loadTodos() {
      try {
        const raw = JSON.parse(localStorage.getItem(TODO_KEY) || '[]')
        // 兼容历史 pinia persist 插件的对象格式 {todos: [...]}
        this.todos = Array.isArray(raw) ? raw : (Array.isArray(raw?.todos) ? raw.todos : [])
      } catch (e) {
        this.todos = []
      }
      // 一次性修复：重写回纯数组格式
      localStorage.setItem(TODO_KEY, JSON.stringify(this.todos))
    },

    async cloudLoadTodos() {
      const s = await cloudFetch('settings')
      if (s && Array.isArray(s.todosData)) {
        this.todos = s.todosData
        localStorage.setItem(TODO_KEY, JSON.stringify(this.todos))
      }
    },

    saveTodos() {
      localStorage.setItem(TODO_KEY, JSON.stringify(this.todos))
      // 同步写入 settings.todosData（由 settingsStore 处理云端写入）
      // 这里发出事件让 settingsStore 感知
      window.dispatchEvent(new CustomEvent('todos-updated', { detail: this.todos }))
    },

    addTodo(data) {
      this.todos.push({
        id: uid(),
        content: data.content,
        deadline: data.deadline,
        time: data.time || '',
        owner: data.owner,
        done: false,
        createdAt: new Date().toISOString()
      })
      this.saveTodos()
    },

    updateTodo(id, patch) {
      const t = this.todos.find(x => x.id === id)
      if (t) {
        Object.assign(t, patch)
        this.saveTodos()
      }
    },

    deleteTodo(id) {
      this.todos = this.todos.filter(x => x.id !== id)
      this.saveTodos()
    },

    toggleDone(id) {
      const t = this.todos.find(x => x.id === id)
      if (t) {
        t.done = !t.done
        this.saveTodos()
      }
    }
  },

})
