package com.wei.Service;

import com.wei.Mapper.PhotoMapper;
import com.wei.Mapper.anniversariesMapper;
import com.wei.UTIL.CullentUtil;
import com.wei.UTIL.OssUtil;
import com.wei.pojo.Photo;
import com.wei.pojo.anniversaries;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@Slf4j
public class anniversariesImpl implements anniversariesService {

    @Autowired
    private anniversariesMapper ANN;

    @Autowired
    private PhotoMapper p;

    @Autowired
    private OssUtil ossUtil;

    @Override
    public List<anniversaries> Get() {

        Integer userId = CullentUtil.get();


        List<anniversaries> anniversaries = ANN.Get(userId);

        return anniversaries;
    }

    @Override
    public Integer insertAnn(anniversaries a) {

        //先获取当前token里的userId存入实体类中
        a.setUserId(CullentUtil.get());

        anniversaries b = ANN.getAnn(a);//获取当前用户title是否重复

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
    public anniversaries GetannID(Integer id) {
        anniversaries b = new anniversaries();

        b.setUserId(CullentUtil.get());

        b.setId(id);

        anniversaries a = ANN.GetannID(b);

        return a;
    }


    /*
     *
     * 先删在添加
     *
     * */
    @Override
    public anniversaries update(anniversaries a) {

        LocalDate now = LocalDate.now();

        a.setUserId(CullentUtil.get());

        a.setUpdatedAt(now);

        int i = ANN.update(a);

        log.info("更新行数" + i + "更新列表id" + a.getId() + "本用户id" + a.getUserId());

        if (i != 0) {
            anniversaries b = ANN.GetannID(a);
            return b;
        }

        return null;
    }

    @Override
    public Object delete(Integer id) {
        try {
            anniversaries b = new anniversaries();
            b.setId(id);
            b.setUserId(CullentUtil.get());

            /*
             * 先查当前该纪念日的bgImage和key(第一次添加纪念日的时候还没key)
             * */

            anniversaries c = ANN.GetannID(b);

            if(c==null){//不存在纪念日
                return null;
            }

            if (c.getBgImage() != null) {//存在纪念日并有背景图
                Integer i = ANN.delete(b);
                c.setUserId(CullentUtil.get());
                Photo po = p.selectKey(c);
                if (i > 0) {
                    List<anniversaries> list = ANN.selectBgimage(b);
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
