<script setup lang="ts">
import { VueTurnstile } from 'vue-cloudflare-turnstile'
const site_key=import.meta.env.VITE_SITE_KEY;

const emit=defineEmits(['succeess','error','expired','timeout'])

const handleSuccess = async (token: string) => {
        emit('succeess',token);
  }



  const handleError=(errors?:string)=>{
      emit('error',errors)
  }


  const habdleExpired=()=>{
  
    emit('expired');
  
  }
  const handleTimeout=()=>{
    emit('timeout');
  }


</script>

<template>
  <VueTurnstile
    :site-key="site_key"
    theme="light"
    @success="handleSuccess"
    retryInterval="5000"
    @error="handleError"
    @expired="habdleExpired"
    @timeout="handleTimeout"
  />
</template>