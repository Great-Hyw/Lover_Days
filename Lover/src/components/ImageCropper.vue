<script setup>
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'

/**
 * 图片裁剪组件（基于 cropperjs）
 *
 * 用法：
 *   <ImageCropper v-model:visible="visible" :file="file" @confirm="onCropped" />
 * - file：File 对象（本地选择的图片）
 * - confirm：裁剪完成，回传 { blob, file }，file 为可直接上传的新 File
 */
const props = defineProps({
  visible: { type: Boolean, default: false },
  file: { type: [File, Object], default: null },
  // 也可直接传图片地址（裁剪云端图片时）
  src: { type: String, default: '' }
})

const emit = defineEmits(['update:visible', 'confirm'])

const imgRef = ref(null)
const cropper = ref(null)
const processing = ref(false)
let objectUrl = ''

// 宽高比选项（Hero 卡片是横向的，默认 16:9）
const ratios = reactive([
  { label: '自由', value: NaN },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 }
])
const activeRatio = ref(16 / 9)

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      await init()
    } else {
      destroy()
    }
  }
)

async function init() {
  // 等待模板中的 img 渲染
  await nextTickFrame()

  if (props.file) {
    objectUrl = URL.createObjectURL(props.file)
    imgRef.value.src = objectUrl
  } else if (props.src) {
    imgRef.value.src = props.src
  }

  await nextTickFrame()

  cropper.value = new Cropper(imgRef.value, {
    viewMode: 1,
    dragMode: 'move',
    aspectRatio: Number.isNaN(activeRatio.value) ? NaN : activeRatio.value,
    autoCropArea: 0.9,
    background: false,
    movable: true,
    zoomable: true,
    rotatable: true,
    scalable: true,
    responsive: true,
    guides: true,
    center: true,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: true
  })
}

function destroy() {
  if (cropper.value) {
    cropper.value.destroy()
    cropper.value = null
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
}

function setRatio(value) {
  activeRatio.value = value
  cropper.value?.setAspectRatio(Number.isNaN(value) ? NaN : value)
}

function rotate(deg) {
  cropper.value?.rotate(deg)
}

function zoom(ratio) {
  cropper.value?.zoom(ratio)
}

function close() {
  emit('update:visible', false)
}

async function confirmCrop() {
  if (!cropper.value) return
  processing.value = true
  try {
    const canvas = cropper.value.getCroppedCanvas({
      maxWidth: 2048,
      maxHeight: 2048,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      fillColor: '#fff'
    })

    if (!canvas) {
      close()
      return
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    )

    const originalName = props.file?.name?.replace(/\.[^.]+$/, '') || 'photo'
    const croppedFile = new File([blob], `${originalName}-cropped.jpg`, {
      type: 'image/jpeg'
    })

    emit('confirm', { blob, file: croppedFile })
    close()
  } finally {
    processing.value = false
  }
}

function nextTickFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

onBeforeUnmount(destroy)
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="cropper-mask" @click.self="close">
      <div class="cropper-dialog pop-in">
        <h3 class="cropper-title">裁剪图片</h3>

        <div class="cropper-stage">
          <img ref="imgRef" alt="待裁剪图片" />
        </div>

        <!-- 比例 -->
        <div class="tool-group">
          <span class="tool-label">比例</span>
          <button
            v-for="r in ratios"
            :key="r.label"
            type="button"
            class="tool-btn"
            :class="{ active: activeRatio === r.value }"
            @click="setRatio(r.value)"
          >
            {{ r.label }}
          </button>
        </div>

        <!-- 操作 -->
        <div class="tool-group">
          <span class="tool-label">调整</span>
          <button type="button" class="tool-btn" title="向左旋转" @click="rotate(-90)">↺</button>
          <button type="button" class="tool-btn" title="向右旋转" @click="rotate(90)">↻</button>
          <button type="button" class="tool-btn" title="放大" @click="zoom(0.1)">＋</button>
          <button type="button" class="tool-btn" title="缩小" @click="zoom(-0.1)">－</button>
        </div>

        <div class="cropper-actions">
          <button type="button" class="btn btn-ghost" @click="close">取消</button>
          <button type="button" class="btn btn-primary" :disabled="processing" @click="confirmCrop">
            {{ processing ? '处理中…' : '使用此图' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.cropper-mask {
  position: fixed;
  inset: 0;
  background: rgba(40, 28, 38, 0.6);
  backdrop-filter: blur(3px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.cropper-dialog {
  width: 100%;
  max-width: 560px;
  max-height: 94vh;
  overflow-y: auto;
  background: #fff;
  border-radius: var(--radius-md);
  padding: 20px 20px 18px;
  box-shadow: var(--shadow-lg);
}

.cropper-title {
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 14px;
}

.cropper-stage {
  width: 100%;
  height: 42vh;
  min-height: 220px;
  max-height: 380px;
  background: #f6eef3;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.cropper-stage img {
  display: block;
  max-width: 100%;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
}

.tool-label {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-right: 4px;
}

.tool-btn {
  min-width: 38px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text);
  background: #faf5f8;
  border: 1.5px solid transparent;
  transition: all 0.15s;
}

.tool-btn:hover {
  background: var(--pink-bg);
}

.tool-btn.active {
  color: var(--pink);
  border-color: var(--pink-lighter);
  background: var(--pink-bg);
  font-weight: 700;
}

.cropper-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.cropper-actions .btn {
  flex: 1;
}
</style>
