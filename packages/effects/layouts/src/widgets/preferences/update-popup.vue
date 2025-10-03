<script setup lang="ts">
import { ref, watch } from 'vue';

import { $t } from '@vben/locales';

import { useVbenModal } from '@vben-core/popup-ui';

const props = defineProps<{
  error?: string;
  progress?: number;
  status?: 'available' | 'checking' | 'downloaded' | 'downloading' | 'error';
  versionInfo?: any;
}>();

const emit = defineEmits<{
  check: [];
  download: [];
  install: [];
}>();

const [UpdateModal, modalApi] = useVbenModal({
  title: $t('preferences.updateTitle'),
  fullscreenButton: false,
  footer: false,
});

const statusText = ref('');

// 格式化文件大小
function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

// 监听状态变化
watch(
  () => props.status,
  (newStatus) => {
    switch (newStatus) {
      case 'available': {
        statusText.value = `${$t('preferences.updateAvailable')} ${
          props.versionInfo?.version || ''
        }`;
        break;
      }
      case 'checking': {
        statusText.value = $t('preferences.updateChecking');
        break;
      }
      case 'downloaded': {
        statusText.value = $t('preferences.updateDownloaded');
        break;
      }
      case 'downloading': {
        statusText.value = $t('preferences.updateDownloading');
        break;
      }
      case 'error': {
        statusText.value = `${$t('preferences.updateError')}: ${props.error}`;
        break;
      }
      default: {
        statusText.value = '';
      }
    }
  },
  { immediate: true },
);

function handleCheck() {
  emit('check');
}

function handleDownload() {
  emit('download');
}

function handleInstall() {
  emit('install');
}

// 添加调试日志
function open() {
  modalApi.open();
}

function close() {
  modalApi.close();
}

defineExpose({
  open,
  close,
});
</script>

<!-- 其余代码保持不变 -->
<template>
  <UpdateModal>
    <div class="p-4">
      <div class="mb-4 text-center">
        <div class="mb-2 text-lg font-medium">{{ statusText }}</div>

        <!-- 错误信息 -->
        <div v-if="status === 'error'" class="text-sm text-red-500">
          {{ error }}
        </div>

        <!-- 版本信息 -->
        <div
          v-if="status === 'available' && versionInfo"
          class="mt-2 text-sm text-gray-600"
        >
          <div class="mb-3 grid grid-cols-2 gap-2 text-left">
            <div>
              <div class="text-gray-500">
                {{ $t('preferences.currentVersion') }}:
              </div>
              <div>{{ versionInfo?.version || $t('preferences.unknown') }}</div>
            </div>
            <div v-if="versionInfo?.files?.[0]?.url">
              <div class="text-gray-500">{{ $t('preferences.fileSize') }}:</div>
              <div>{{ formatFileSize(versionInfo.files[0].size) }}</div>
            </div>
          </div>

          <div v-if="versionInfo?.releaseNotes">
            <div class="mb-1 font-medium">
              {{ $t('preferences.releaseNotes') }}:
            </div>
            <div
              class="max-h-32 overflow-y-auto rounded bg-gray-100 p-2 text-left"
            >
              {{ versionInfo.releaseNotes }}
            </div>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="status === 'downloading'" class="mb-4">
        <div class="h-2.5 w-full rounded-full bg-gray-200">
          <div
            class="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
            :style="{ width: `${progress || 0}%` }"
          ></div>
        </div>
        <div class="mt-1 text-right text-sm text-gray-600">
          {{ Math.round(progress || 0) }}%
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-center gap-2">
        <button
          v-if="status === 'available'"
          @click="handleDownload"
          class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          {{ $t('preferences.downloadUpdate') }}
        </button>

        <button
          v-else-if="status === 'downloaded'"
          @click="handleInstall"
          class="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
        >
          {{ $t('preferences.restartAndInstall') }}
        </button>

        <button
          v-else-if="status === 'error' || status === undefined"
          @click="handleCheck"
          class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          :disabled="status === 'checking'"
        >
          {{
            status === 'checking'
              ? $t('preferences.checking')
              : $t('preferences.checkUpdates')
          }}
        </button>

        <button
          v-if="status === 'downloading'"
          disabled
          class="rounded bg-gray-300 px-4 py-2 text-white"
        >
          {{ $t('preferences.downloading') }}...
        </button>
      </div>
    </div>
  </UpdateModal>
</template>
