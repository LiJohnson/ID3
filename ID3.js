(function(win){
	"use strict";

	var ID3 = function( file ){
		var $this = this;
		
		/**
		 * 读取文件
		 * @param  int   start 起始字节下标
		 * @param  int   end   结束字节下标（不包含end）
		 * @param  Function cb 回调，返回结果
		 * @param  string   type  [可选]，读取类型或字符编码，可为：
		 *                        		1、dataurl:返回一个base64数据
		 *                        		2、byte：返回一个Uint8Array数据
		 *                        		3、相应字符集，如 'urf-8'
		 * @return void
		 */
		var read = this.read = function(start , end , cb , type){
			start = Math.floor(start) || 0;
			end = Math.floor(end) || 0;

			type = type || "text";

			var fileReader = new FileReader();
			fileReader.onload = function(){
				cb.call( $this , fileReader.result );
			};

			var data = file.slice(start , end);
			
			if(/dataurl/.test(type)){
				fileReader.readAsDataURL( data );
			}else if( /byte/.test(type) ){
				fileReader.onload = function(){
					cb.call( $this ,new Uint8Array( fileReader.result ) , fileReader.result , file);
				};
				fileReader.readAsArrayBuffer( data )
			}else{
				fileReader.readAsText( file.slice(start , end) , type )
			}
		};

		/**
		 * 将一个Uint8Array转为一个整数
		 * @param  Uint8Array data 数据
		 * @param  int base 进制
		 * @return int
		 */
		var coverToInt = function(data , base){
			base = base || 128;
			var total = 0;
			for( var i = 0 ; i < data.length ; i++ ){
				total += data[i] * Math.pow( base , data.length - 1 - i );
			}
			return total;
		};

		/**
		 * 将一个Uint8Array转为一个String
		 * @param  Uint8Array   data 数据
		 * @param  Function cb   [可选],可用来中断转换
		 * @return String
		 */
		var coverToStr = function( data , cb ){
			var str = "";
			for( var i = 0 ; i < data.length ; i++ ){
				var code = cb ? cb.call( data[i] , data[i] , i ) : data[i];
				if( code === false )return str;
				str +=  String.fromCharCode(code || data[i]) ;
			}
			return str;
		};

		/**
		 * 读取图片信息
		 * @param  int   start 起始字节下标
		 * @param  int   end   结束字节下标（不包含end）
		 * @param  Uint8Array   byteData 为图片标签的Uint8Array数据
		 * @param  Function cb  读取成功后调用，传入一入String和一个Blob
		 * @return void
		 */
		var readPic = function(index,end,byteData,cb){
			var offset = 1;
			var format = coverToStr(byteData.subarray(offset), function( code , index ){
				if( code == 0 ){
					offset = index;
					return false;
				}else{
					return code;
				};
			});

			if( offset > 1 ){
				var subData = byteData.subarray(offset);
				var count = 0;
				for( var i = 0 ; i < subData.length ; i++ ){
					if( subData[i] == 0 ){
						count++;
					}else{
						if( count >= 2 ){
							offset += i;
							break;
						}else{
							count=0;
						}
					}
				}
			}
			cb( URL.createObjectURL(file.slice(index+offset,end,format)) , file.slice(index+offset,end,format) );

			//read( index + offset  , end  , function(data){
			//	cb( data.replace(/^data:/,"data:" + format) , file.slice(index+offset,end,format) );
			//},"dataurl");
		};

		/**
		 * 获取字符集编码
		 * @param  int type 
		 * @return 
		 */
		var getCharSet = (function(){
			var data = {
				"0":"iso-8859-1",
				"1":"utf-16",
				"2":"utf-16be",
				"3":"utf-8"
			};
			return function(type){
				return data[type] || "utf-8";
			}
		})();

		/**
		 * 获取总大小
		 * @param  Function cb 回调
		 * @return void
		 */
		this.getTotalSize = function(cb){
			read(6,10,function(data){
				cb.call( this , coverToInt(data,128) );
			},"byte");
		};

		/**
		 * 读取一个标签
		 * @param  int   index 标签起始下标
		 * @param  Function cb 读取成功后回调，传入标签的相关信息
		 * @return 
		 */
		this.readTag = function(index,cb){
			read( index , index + 10 , function(head){
				var end = index + 10 + coverToInt( head.subarray(4,8) , 256 );
				var tag = coverToStr( head.subarray(0,4) );
				read( index + 10 , end  , function(byteData){
					var charSet = getCharSet(byteData[0]);
					var callback = function(text,blob){
						cb.call(this , { start:index , end:end , blob:blob,tag:tag , text:text ,byteData:byteData});
					};

					if( /pic/i.test( tag ) ){
						readPic( index + 10 , end , byteData , callback , charSet  );
					}else{
						read( index + 11 , end , callback , charSet );
					}
					//*************************
				},"byte");
			} , "byte");
		};

		/**
		 * 获取ID3相关信息
		 * @param  Function cb 	读取成功后回调，传入标签的相关信息
		 * @return void
		 */
		this.getData = function( cb ){
			read(0,10,function(id3){
				if( !/id3/i.test(coverToStr( id3.subarray(0,3)) )  ){
					throw("just supported ID3");
				};
				if(  id3[3] < 3  ){
					throw("just supported ID3v2.3");
				}

				this.getTotalSize(function(totalSize){
					var end = totalSize +0;
					var readAllTag = function(index,cb , result){
						result = result || [];//  [{text:id3,tag:totalSize,b:[]}];
						if( index >= end )return cb.call($this,result);
						
						$this.readTag( index , function(data){
							
							read(index,data.end,function(b){
								data.b=[];
								for( var i = 0 ; i < b.length ; i++ ){
									data.b[i] = b[i].toString(16);
								}
								data.end > data.start+11 && result.push(data);
								
								readAllTag( data.end , cb , result);
							},"byte");
							
						});
					};

					readAllTag( 10 , function(data){
						var map = {};
						data.forEach(function(data){
							map[data.tag] = data;
						});
						cb.call($this,data,map);
					});
				});
			},"byte");
		};
	};

	win.ID3 = ID3;
})(this);