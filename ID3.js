(function(win){
	"use strict";

	var ID3 = function( file , chartSet ){
		var $this = this;
		
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

		var coverToInt = function(data , base){
			base = base || 128;
			var total = 0;
			for( var i = 0 ; i < data.length ; i++ ){
				total += data[i] * Math.pow( base , data.length - 1 - i );
			}
			return total;
		};

		var coverToStr = function( data , cb ){
			var str = "";
			for( var i = 0 ; i < data.length ; i++ ){
				var code = cb ? cb.call( data[i] , data[i] , i ) : data[i];
				if( code === false )return str;
				str +=  String.fromCharCode(code) ;
			}
			return str;
		};

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

		this.getTotalSize = function(cb){
			read(6,10,function(data){
				cb.call( this , coverToInt(data,128) );
			},"byte");
		};

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

		this.getData = function( cb ){
			read(0,10,function(id3){

				if( !/id3/i.test(coverToStr( id3.subarray(0,3)) ) || id3[3] < 3  )return cb(false);
				this.getTotalSize(function(totalSize){
					var end = totalSize +0;
					var readAllTag = function(index,cb , result){
						result = result ||  [{text:id3,tag:totalSize,b:[]}];
						if( index >= end )return cb.call($this,result);
						
						$this.readTag( index , function(data){
							
							read(index,data.end,function(b){
								data.b=[];
								for( var i = 0 ; i < b.length ; i++ ){
									data.b[i] = b[i].toString(16);
								}
								data.end > data.start+11 && result.push(data);
								console.log("LCS" , data);
								readAllTag( data.end , cb , result);
							},"byte");
							
						});
					};

					readAllTag( 10 , function(data){
						console.log(window.d = data);
						cb.call($this,data);
					});
				});
			},"byte");
		};
	};

	win.ID3 = ID3;
})(this);