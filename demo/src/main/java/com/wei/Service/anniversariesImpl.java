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

import java.time.LocalDate;
import java.util.List;

@Service
@Slf4j
public class AnniversariesImpl implements AnniversariesService {

    @Autowired
    private AnniversariesMapper ANN;

    @Autowired
    private PhotoMapper p;

    @Autowired
    private OssUtil ossUtil;

    @Override
    public List<Anniversaries> Get() {

        Integer userId = CullentUtil.get();


        List<Anniversaries> anniversaries = ANN.Get(userId);

        return anniversaries;
    }

    @Override
    public Integer insertAnn(Anniversaries a) {

        //先获取当前token里的userId存入实体类中
        a.setUserId(CullentUtil.get());

        Anniversaries b = ANN.getAnn(a);//获取当前用户title是否重复

        if (b != null) {//有重复
            return -1;
        }

        LocalDate now = LocalDate.now();

        a.setCreatedAt(now);

        Integer i = ANN.insertann(a);

        log.info("新建成功："+a.toString());
        return i;
    }


    @Override
    public Anniversaries GetannID(Integer id) {
        Anniversaries b = new Anniversaries();

        b.setUserId(CullentUtil.get());

        b.setId(id);

        Anniversaries a = ANN.GetannID(b);

        return a;
    }


    /*
     *
     * 先删在添加
     *
     * */
    @Override
    public Anniversaries update(Anniversaries a) {

        LocalDate now = LocalDate.now();

        a.setUserId(CullentUtil.get());

        a.setUpdatedAt(now);

        int i = ANN.update(a);

        log.info("更新行数" + i + "更新列表id" + a.getId() + "本用户id" + a.getUserId());

        if (i != 0) {
            Anniversaries b = ANN.GetannID(a);
            return b;
        }

        return null;
    }

    @Override
    public Object delete(Integer id) {
        try {
            Anniversaries b = new Anniversaries();
            b.setId(id);
            b.setUserId(CullentUtil.get());

            Anniversaries c = ANN.GetannID(b);

            if(c==null){//不存在纪念日
                return null;
            }

            if (c.getBgImage() != null) {//存在纪念日并有背景图
                Integer i = ANN.delete(b);
                c.setUserId(CullentUtil.get());
                Photo po = p.selectKey(c);
                if (i > 0) {
                    List<Anniversaries> list = ANN.selectBgimage(b);
                    if (list.isEmpty()) {//没别的引用删除photo里的背景图和阿里云
                        p.deleteBgImage(c);

                        ossUtil.delete(po.getKey());

                        return c;
                    }
                }
            }
            else {/*
             *  没背景图的时候直接删除该纪念日
             * */

                ANN.delete(b);
            }

        } catch (Exception e) {

            log.info("删除图片模块有异常" + e.getMessage());


            throw new RuntimeException(e);

        }
        return 1;
    }


}
