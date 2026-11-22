package com.wei.service;


import com.wei.mapper.PhotoMapper;
import com.wei.mapper.AnniversariesMapper;
import com.wei.util.CullentUtil;
import com.wei.util.OssUtil;
import com.wei.pojo.Photo;
import com.wei.pojo.Anniversaries;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@Service
@Slf4j
public class PhotoImpl implements PhotoService {

    @Autowired
    private PhotoMapper photoMapper;
    @Autowired
    private AnniversariesMapper a;
    @Autowired
    private OssUtil OssUtil;

    @Override
    public Photo upload(MultipartFile file, Integer id) {
        Photo p = new Photo();
        String[] arg = OssUtil.uploadImage(file);//保存在阿里云
        p.setKey(arg[1]);
        p.setUrl(arg[0]);
        p.setName(file.getOriginalFilename());
        p.setSize(file.getSize());
        p.setCreatedAt(LocalDate.now());
        p.setUserId(CullentUtil.get());
        //将数据保存在数据库
        try {
            photoMapper.uploadImage(p);
        } catch (RuntimeException e) {
            try {
                OssUtil.delete(arg[1]);
            } catch (Exception ex) {
                log.error("oss兜底保护失败"+ex);
            }
            throw e;
        }
        return p;
    }

    @Override
    public Integer delete(Photo p) {

        try {
            p.setUserId(CullentUtil.get());
            //查url
            Anniversaries A= photoMapper.select(p);//查url
            A.setUserId(CullentUtil.get());

            Integer i = photoMapper.delete(p);//先删除数据库的数据
            if(i>0) {
                //更新url为‘’
                a.updateann(A, null);

                OssUtil.delete(A.getIkey());//删除阿里云
                return 1;
            }

        } catch (Exception e) {

            log.error("删除失败"+e.getMessage());


        }


        return 0;
    }

    @Override
    public List<Photo> getAll(Integer lastId) {

        Photo p =new Photo();
        p.setUserId(CullentUtil.get());
        p.setLastId(lastId);


        return photoMapper.selectAll(p);
    }
}
