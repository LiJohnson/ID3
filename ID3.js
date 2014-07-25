(function(win){
	"use strict";

	var ID3 = function( file ){
		var $this = this;
		var fileReader = new FileReader();
		var read = function(start , end , cb , type){
			start = Math.floor(start) || 0;
			end = Math.floor(end) || 0;

			type = type || "text";

			fileReader.onload = function(){
				cb.call( $this , fileReader.result );
			};

			var data = file.slice(start , end);
			if( /text/.test(type) ){
				fileReader.readAsText( data )
			}else if(/dataurl/.test(type)){
				fileReader.readAsDataUrl( data );
			}else if( /byte/.test(type) ){
				fileReader.onload = function(){
					cb.call( $this , new Uint8Array( fileReader.result ) );
				};
				fileReader.readAsArrayBuffer( data )
			}else{
				fileReader.readAsText( file.slice(start , end) )
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

		this.getTotalSize = function(cb){
			read(6,10,function(data){
				cb.call( this , coverToInt(data,128) );
			},"byte");
		};

		this.readTag = function(index,cb){
			read( index , index + 10 , function(head){
				var end = index + 10 + coverToInt( head.subarray(4,8) , 256 );
				read(index , index + 4 , function(text,tag){
					read( index + 10 , end , function(tag){
						cb.call(this , { start:index , end:end , tag:tag , text:text , blob : file.slice( index+10 , end ) , head:head });	
					});
					
				});
			} , "byte" );
		};

		this.getData = function( cb ){
			read(0,3,function(id3){
				if( !/id3/i.test(id3) )return cb(false);
				this.getTotalSize(function(totalSize){
					var result = [];
					var end = totalSize +0;

					var readAllTag = function(index,cb){
						if( index >= end )return cb.call($this);
						
						$this.readTag( index , function(data){
							data.blob.size && result.push(data);
							readAllTag( data.end , cb );
						});
					};

					readAllTag( 10 , function(data){
						console.log(window.d = result);
						cb.call($this,result);
					});

				});
				
			});
		};
	};

	win.ID3 = ID3;
})(this);