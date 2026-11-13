import request from './request'


export function postRoobits(token){
     return request({
    url: '/auth/login',
    method: 'post',
    data:{
        rtoken:token
    }
  })
}
