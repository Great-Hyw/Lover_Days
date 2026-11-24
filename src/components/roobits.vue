<script setup lang="ts">
import { VueTurnstile } from 'vue-cloudflare-turnstile'
import { useRouter} from 'vue-router'


const emit=defineEmits(['succeess','error','expired','timeout'])

const router =useRouter();

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
    site-key="0x4AAAAAAGDZF-Gcr5tEQO2n"
    @success="handleSuccess",
    @error="handleError"
    @expired="habdleExpired"
    @timeout="handleTimeout"
  />
</template>