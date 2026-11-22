<script setup lang="ts">
import{postRoobits}from '@/api/roobits.js'
import { VueTurnstile } from 'vue-cloudflare-turnstile'
import { removeCookie, setCookie } from '../utils/cookie';
import { useRouter} from 'vue-router'


const emit=defineEmits(['succeess','error','expired','timeout'])

const router =useRouter();

   const handleSuccess = async (token: string) => {
    console.log('Turnstile token:', token)
    const response= await postRoobits(token);
    if(response){
    setCookie("rtoken",'ok',Date.now()+30*60*1000)
      router.push("/login")
  }
  emit('succeess',token);


  }


  const handleError=(errors?:string)=>{
      emit('error',errors)
        console.log(errors)
        removeCookie("rtoken")
  }


  const habdleExpired=()=>{
  
    emit('expired');
    console.log("人机验证令牌过期");
    
  }
  const handleTimeout=()=>{
    console.log("超时");
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