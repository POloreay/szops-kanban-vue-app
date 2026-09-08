<template>
  <div class="gate-mask">
    <div class="gate-wrap">
      <!-- 左：品牌叙事区 -->
      <div class="b-left">
        <div class="b-brandline">
          <span class="logo">数</span>
          <span>数智运营看板 · DIGITAL OPERATIONS</span>
        </div>
        <div class="b-hero">
          <div class="b-hello">无敌牛马，<br />欢迎回来！</div>
          <div class="b-sub">
            鞍已备好，粮草已足 —— 每一铲都算数。<br />
            今日份数字粮草已装车，请查收。
          </div>
        </div>
        <div class="b-stats">
          <div class="b-stat"><div class="v">80</div><div class="l">在管项目</div></div>
          <div class="b-stat"><div class="v">31,211<span class="unit">万</span></div><div class="l">合同总额</div></div>
          <div class="b-stat"><div class="v">98%</div><div class="l">按期交付</div></div>
        </div>
      </div>

      <!-- 右：登录表单区 -->
      <div class="b-right">
        <h3>登录</h3>
        <div class="b-tip">请登录账号，开工前请系好安全带</div>
        <input
          v-model="loginForm.username"
          class="b-in"
          type="text"
          placeholder="用户名"
          autocomplete="username"
          @keyup.enter="handleLogin"
        />
        <input
          v-model="loginForm.password"
          class="b-in"
          type="password"
          placeholder="密码"
          autocomplete="current-password"
          @keyup.enter="handleLogin"
        />
        <button class="b-btn" type="button" :disabled="loading" @click="handleLogin">{{ loading ? '登录中…' : '开工' }}</button>
        <div v-if="errorMsg" class="b-err">{{ errorMsg }}</div>
        <div class="b-foot">我能抗住什么责任，我是个溜肩啊......</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useUserStore } from '../../stores/userStore'
import { useLogStore } from '../../stores/logStore'

const userStore = useUserStore()
const logStore = useLogStore()
const loginForm = reactive({ username: '', password: '' })

const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  if (!loginForm.username || !loginForm.password) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    const ok = await userStore.login(loginForm.username, loginForm.password)
    if (ok) {
      logStore.addLog('登录', '用户 ' + userStore.currentUser.username + ' 登录系统', userStore.currentUser.username)
      userStore.resumePending()
    } else {
      errorMsg.value = '用户名或密码错误'
    }
  } catch (e) {
    errorMsg.value = e.message || '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.gate-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(90% 120% at 85% -10%, rgba(79, 138, 242, 0.5) 0%, transparent 50%),
    radial-gradient(70% 90% at -10% 110%, rgba(24, 52, 120, 0.7) 0%, transparent 55%),
    linear-gradient(160deg, #0b1c45 0%, #123a8f 55%, #1d59d9 100%);
}

.gate-wrap {
  position: relative;
  width: 860px;
  max-width: 94%;
  height: 420px;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  box-shadow: 0 30px 70px -16px rgba(5, 15, 45, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

/* 左：品牌叙事区 */
.b-left {
  flex: 1.25;
  position: relative;
  color: #fff;
  padding: 40px 38px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  background:
    radial-gradient(90% 120% at 85% -10%, rgba(79, 138, 242, 0.5) 0%, transparent 50%),
    radial-gradient(70% 90% at -10% 110%, rgba(24, 52, 120, 0.7) 0%, transparent 55%),
    linear-gradient(160deg, #0b1c45 0%, #123a8f 55%, #1d59d9 100%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 34px 34px;
  }

  &::after {
    content: '';
    position: absolute;
    right: -60px;
    top: -60px;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(91, 142, 240, 0.4) 0%, transparent 65%);
  }
}

.b-brandline {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  letter-spacing: 4px;
  opacity: 0.9;

  .logo {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 15px;
  }
}

.b-hero {
  display: flex;
  flex-direction: column;

  .b-hello {
    font-size: 30px;
    font-weight: 800;
    line-height: 1.35;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
  }

  .b-sub {
    margin-top: 10px;
    font-size: 13px;
    opacity: 0.78;
    letter-spacing: 1px;
    line-height: 1.8;
  }
}

.b-stats {
  display: flex;
  gap: 26px;

  .v {
    font-size: 19px;
    font-weight: 800;
    font-family: 'SF Mono', Consolas, monospace;
  }

  .l {
    font-size: 11px;
    opacity: 0.65;
    margin-top: 2px;
    letter-spacing: 1px;
  }

  .unit {
    font-size: 11px;
  }
}

/* 右：登录表单区 */
.b-right {
  flex: 1;
  background: #fff;
  padding: 38px 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  h3 {
    font-size: 17px;
    font-weight: 700;
    margin: 0;
  }

  .b-tip {
    font-size: 12px;
    color: #9aa3af;
    margin: 4px 0 22px;
  }
}

.b-in {
  width: 100%;
  height: 44px;
  border: 1.5px solid #e5e7eb;
  border-radius: 11px;
  padding: 0 13px;
  font-size: 14px;
  font-family: inherit;
  background: #fafbfd;
  outline: none;
  margin-bottom: 12px;
  transition: all 0.2s;

  &::placeholder {
    color: #9aa3af;
  }

  &:focus {
    border-color: #2f6feb;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(47, 111, 235, 0.12);
  }
}

.b-btn {
  width: 100%;
  height: 44px;
  margin-top: 6px;
  border: none;
  border-radius: 11px;
  background: #0f2a66;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 8px;
  text-indent: 8px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #1d59d9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    letter-spacing: 2px;
  }
}

.b-foot {
  text-align: center;
  font-size: 11px;
  color: #9aa3af;
  margin-top: 16px;
  letter-spacing: 2px;
}

.b-err {
  margin-top: 10px;
  font-size: 12px;
  color: #e5484d;
  line-height: 1.5;
  background: #fdf0f0;
  border: 1px solid #f5c6c8;
  border-radius: 8px;
  padding: 7px 10px;
  word-break: break-all;
}
</style>
