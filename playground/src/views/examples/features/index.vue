<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import UpdateModal from './update-modal.vue';

defineOptions({
  name: 'FeaturesExample',
});

// 定义更新状态相关的响应式数据
const updateStatus = ref({
  checking: false,
  downloading: false,
  downloaded: false,
  error: '',
  info: null as any,
  progress: 0,
  updateAvailable: false,
  message: '',
});

const updateModalRef = ref();
const updateInfo = ref<any>(null);

// 检查更新
function checkForUpdates() {
  window.ipcRenderer.send('checkForUpdates');
}

// 下载更新
function downloadUpdate() {
  window.ipcRenderer.send('downLoadUpdate');
}

// 退出并安装更新
function quitAndInstall() {
  window.ipcRenderer.send('quitAndInstall');
}

// 处理模态框事件
function handleCheck() {
  checkForUpdates();
}

function handleDownload() {
  downloadUpdate();
}

function handleInstall() {
  quitAndInstall();
}

onMounted(() => {
  // 监听主进程发送的更新相关事件
  window.ipcRenderer.on('uploadMessage', (_event, args) => {
    console.warn(args);
    const { payload, output } = args;
    const { msg, status } = payload;
    updateStatus.value.message = msg;
    updateInfo.value = output;

    const handle = {
      '-1': () => {
        updateStatus.value.error = msg;
        updateModalRef.value?.open();
      },
      '0': () => {
        updateStatus.value.checking = true;
      },
      '1': () => {
        updateStatus.value.updateAvailable = true;
        updateModalRef.value?.open();

        // 发送下载请求
        // downloadUpdate();
      },
      '2': () => {
        updateStatus.value.checking = false;
        updateStatus.value.updateAvailable = false;
        updateStatus.value.downloaded = false;
      },
      '3': () => {
        updateStatus.value.downloaded = true;
        updateStatus.value.message = msg;
        // updateModalRef.value?.open();
      },
    };

    if (handle[`${status}`]) {
      handle[`${status}`]();
    }
  });

  window.ipcRenderer.on('downloadProgress', (_event, data) => {
    const { percent } = data;
    updateStatus.value.progress = Number.parseFloat((percent || 0).toFixed(2));
    if (percent >= 100) {
      updateStatus.value.downloading = false;
    }
  });

  // 初始化时检查更新
  checkForUpdates();
});

const updateStatusValue = computed(() => {
  if (updateStatus.value.downloaded) {
    return 'downloaded';
  } else if (updateStatus.value.updateAvailable) {
    return 'available';
  } else if (updateStatus.value.checking) {
    return 'checking';
  } else if (updateStatus.value.downloading) {
    return 'downloading';
  } else if (updateStatus.value.error) {
    return 'error';
  } else {
    return undefined;
  }
});

// 监听 updateStatusValue 的变化
watch(
  updateStatusValue,
  () => {
    // 可以在这里添加其他需要在状态变化时执行的逻辑
  },
  { immediate: true },
);
</script>

<template>
  <Page title="功能示例" description="展示一些 Electron 应用的特有功能">
    <div class="flex flex-col gap-4">
      <!-- 自动更新功能 -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">自动更新</h3>
          <p class="card-description">Electron 应用自动更新功能演示</p>
        </div>
        <div class="card-content">
          <div class="flex flex-col gap-4">
            <button
              @click="updateModalRef?.open()"
              class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              打开更新弹窗
            </button>
          </div>
        </div>
      </div>

      <!-- 更新弹窗 -->
      <UpdateModal
        ref="updateModalRef"
        :version-info="updateInfo"
        :progress="updateStatus.progress"
        :status="updateStatusValue"
        :error="updateStatus.error"
        @check="handleCheck"
        @download="handleDownload"
        @install="handleInstall"
      />

      <!-- 其他功能示例可以继续添加 -->
    </div>
  </Page>
</template>

<style scoped>
.card {
  @apply bg-card overflow-hidden rounded-lg border;
}

.card-header {
  @apply border-b p-4;
}

.card-title {
  @apply text-lg font-semibold;
}

.card-description {
  @apply text-muted-foreground mt-1 text-sm;
}

.card-content {
  @apply p-4;
}
</style>
