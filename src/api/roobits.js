import request from './request'


export function postRoobits(token){
     return request({
    url: '/welcome',
    method: 'post',
    data:{
        token:token
    }
  })
}
