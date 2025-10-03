<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

import { SUPPORT_LANGUAGES } from '@vben/constants';
import { $t } from '@vben/locales';

import UpdatePopup from '../../update-popup.vue';
import SelectItem from '../select-item.vue';
import SwitchItem from '../switch-item.vue';

defineOptions({
  name: 'PreferenceGeneralConfig',
});

const appLocale = defineModel<string>('appLocale');
const appDynamicTitle = defineModel<boolean>('appDynamicTitle');
const appWatermark = defineModel<boolean>('appWatermark');
const appEnableCheckUpdates = defineModel<boolean>('appEnableCheckUpdates');

// 更新状态相关
const updateStatus = ref<
  'available' | 'checking' | 'downloaded' | 'downloading' | 'error'
>();
const updateProgress = ref(0);
const versionInfo = ref<any>(null);
const errorMessage = ref('');

const updatePopupRef = ref<InstanceType<typeof UpdatePopup> | null>(null);

function handleCheckForUpdates() {
  // 重置状态
  updateStatus.value = 'checking';
  updateProgress.value = 0;
  errorMessage.value = '';

  // 通过 IPC 向主进程发送检查更新请求
  window.ipcRenderer.send('checkForUpdates');

  // 显示更新弹窗
  setTimeout(() => {
    console.warn('尝试打开弹窗');
    updatePopupRef.value?.open();
  }, 0);
}

// 监听主进程发送的更新消息
const handleUpdateMessage = (event: Electron.IpcRendererEvent, data: any) => {
  const { payload, output } = data;
  console.warn('收到更新消息:', payload, output);

  switch (payload.status) {
    case -1: {
      // 错误
      updateStatus.value = 'error';
      errorMessage.value = payload.msg;
      break;
    }
    case 0: {
      // 检查中
      updateStatus.value = 'checking';
      break;
    }
    case 1: {
      // 有新版本
      updateStatus.value = 'available';
      versionInfo.value = output;
      // 确保弹窗打开
      updatePopupRef.value?.open();
      break;
    }
    case 2: {
      // 无新版本
      updateStatus.value = undefined;
      break;
    }
    case 3: {
      // 下载成功
      updateStatus.value = 'downloaded';
      versionInfo.value = output;
      break;
    }
  }
};

// 监听下载进度
const handleDownloadProgress = (
  event: Electron.IpcRendererEvent,
  progress: any,
) => {
  console.warn('下载进度更新:', progress);
  updateStatus.value = 'downloading';
  updateProgress.value = progress.percent;
};

// 下载更新
function handleDownloadUpdate() {
  updateStatus.value = 'downloading';
  updateProgress.value = 0;
  console.warn('发送下载更新请求');
  window.ipcRenderer.send('downLoadUpdate');
}

// 安装更新
function handleInstallUpdate() {
  console.warn('发送安装更新请求');
  window.ipcRenderer.send('quitAndInstall');
}

onMounted(() => {
  // 确保在组件挂载时显示弹窗
  window.ipcRenderer.on('uploadMessage', handleUpdateMessage);
  window.ipcRenderer.on('downloadProgress', handleDownloadProgress);
});

onUnmounted(() => {
  window.ipcRenderer.off('uploadMessage', handleUpdateMessage);
  window.ipcRenderer.off('downloadProgress', handleDownloadProgress);
});
</script>

<template>
  <SelectItem v-model="appLocale" :items="SUPPORT_LANGUAGES">
    {{ $t('preferences.language') }}
  </SelectItem>
  <SwitchItem v-model="appDynamicTitle">
    {{ $t('preferences.dynamicTitle') }}
  </SwitchItem>
  <SwitchItem v-model="appWatermark">
    {{ $t('preferences.watermark') }}
  </SwitchItem>
  <SwitchItem v-model="appEnableCheckUpdates">
    {{ $t('preferences.checkUpdates') }}
  </SwitchItem>
  <div
    v-if="appEnableCheckUpdates"
    class="flex items-center justify-between pt-3"
  >
    <div class="flex-col">
      <div class="text-sm">{{ $t('preferences.manualCheckUpdates') }}</div>
      <div class="text-muted-foreground text-xs">
        {{ $t('preferences.manualCheckUpdatesTip') }}
      </div>
    </div>
    <button
      type="button"
      class="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
      @click="handleCheckForUpdates"
    >
      {{ $t('preferences.checkUpdates') }}
    </button>
  </div>

  <!-- 更新弹窗 -->
  <UpdatePopup
    ref="updatePopupRef"
    :status="updateStatus"
    :progress="updateProgress"
    :version-info="versionInfo"
    :error="errorMessage"
    @check="handleCheckForUpdates"
    @download="handleDownloadUpdate"
    @install="handleInstallUpdate"
  />
</template>
