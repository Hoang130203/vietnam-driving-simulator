'use strict';
// Anchor a regional visit on an existing road arrival. Each stop keeps its own
// coordinates and the camera can move out to an island while the car stays parked.
const heritageVisits=[
  ['vinh-ha-long-cat-ba','Vịnh Hạ Long – quần đảo Cát Bà',['hon-trong-mai','osm-node-4730928605','osm-node-4730928606','osm-node-13570978422','osm-node-4508895511']],
  ['di-tich-co-do-hue','Quần thể di tích Cố đô Huế',['ngo-mon','flag','phu-van-lau','phuoc-duyen','lang-khai-dinh']],
  ['pho-co-hoi-an','Phố cổ Hội An',['chua-cau','hoi-quan-phuc-kien','osm-node-4279640089']],
  ['quan-the-trang-an','Quần thể danh thắng Tràng An',['ben-thuyen-trang-an','osm-node-13399339701','osm-way-1362974362','osm-way-772041809']],
  ['phong-nha-ke-bang','Phong Nha – Kẻ Bàng',['phong-nha','osm-node-3499295493','osm-node-6358064546']],
  ['yen-tu-con-son','Yên Tử – Vĩnh Nghiêm – Côn Sơn, Kiếp Bạc',['osm-way-1579506026','osm-node-4886986961','osm-way-1567975861','osm-way-1567975857','osm-way-1549018362']],
  ['hoang-thanh-thang-long','Hoàng thành Thăng Long',['osm-way-696389268','osm-way-1497572243']],
  ['quang-truong-ba-dinh','Quảng trường Ba Đình và các di tích lân cận',['osm-way-37625751','osm-relation-21401560','osm-way-207178342','osm-way-697326496','osm-way-37629143']],
  ['cong-truong-cong-xa-paris','Công trường Công xã Paris',['buu-dien-sai-gon','osm-way-801950766']],
];
