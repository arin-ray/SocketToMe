
var last10messages = []; //to be populated later
// initially hide the main screen

/*
Functions
*/
function toggleNameForm() {
   $("#login-screen").toggle();
}

function toggleChatWindow() {
  $("#main-chat-screen").toggle();
}

function toggleEmojiPicker(){
  // Initializes and creates emoji set from sprite sheet
  window.emojiPicker = new EmojiPicker({
    emojiable_selector: '[data-emojiable=true]',
    assetsPath: 'components/emoji-picker/lib/img/',
    popupButtonClasses: 'fa fa-smile-o'
  });
  // Finds all elements with `emojiable_selector` and converts them to rich emoji input fields
  // You may want to delay this step if you have dynamically created input fields that appear later in the loading process
  // It can be called as many times as necessary; previously converted input fields will not be converted again
  window.emojiPicker.discover();
}
// Pad n to specified size by prepending a zeros
function zeroPad(num, size) {
  var s = num + "";
  while (s.length < size)
    s = "0" + s;
  return s;
}

// Format the time specified in ms from 1970 into local HH:MM:SS
function timeFormat(msTime) {
  var d = new Date(msTime);
  return zeroPad(d.getHours(), 2) + ":" +
    zeroPad(d.getMinutes(), 2) + ":" +
    zeroPad(d.getSeconds(), 2) + " ";
}

$(document).ready(function() {
  //setup "global" variables first
  var socket = io.connect("127.0.0.1:3000");
  var myRoomID = null;

  $("form").submit(function(event) {
    event.preventDefault();
  });

  $("#conversation").bind("DOMSubtreeModified",function() {
    $("#conversation").animate({
        scrollTop: $("#conversation")[0].scrollHeight
      });
  });

  $("#main-chat-screen").hide();
  $("#errors").hide();
  $("#name").focus();
  $("#join").attr('disabled', 'disabled'); 
  
  if ($("#name").val() === "") {
    $("#join").attr('disabled', 'disabled');
  }

  //enter screen
  $("#nameForm").submit(function() {
    var name = $("#name").val();
    var device = "desktop";
    if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
      device = "mobile";
    }
    if (name === "" || name.length < 2) {
      $("#errors").empty();
      $("#errors").append("Please enter a name");
      $("#errors").show();
    } else {
      socket.emit("joinserver", name, device);
      toggleNameForm();
      toggleChatWindow();

      $("#msg").focus();


    }
  });

  $("#name").keypress(function(e){
    var name = $("#name").val();
    if(name.length < 2) {
      $("#join").attr('disabled', 'disabled'); 
    } else {
      $("#errors").empty();
      $("#errors").hide();
      $("#join").removeAttr('disabled');
    }
  });

  //main chat screen
  $("#chatForm").submit(function() {
    var msg = $("#msg").val();
    console.log('chatt submit')
    console.log(msg)

    if (msg !== "") {
      socket.emit("send", new Date().getTime(), msg);
      $("#msg").val("");
    }
  });

  //'is typing' message
  var typing = false;
  var timeout = undefined;

  function timeoutFunction() {
    typing = false;
    socket.emit("typing", false);
  }

  $("#msg").keypress(function(e){
    if (e.which !== 13) {
      if (typing === false && myRoomID !== null && $("#msg").is(":focus")) {
        typing = true;
        socket.emit("typing", true);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(timeoutFunction, 5000);
      }
    }
  });

  socket.on("isTyping", function(data) {
    if (data.isTyping) {
      if ($("#"+data.person+"").length === 0) {
        $("#updates").append("<li id='"+ data.person +"'><span class='text-muted'><small><i class='fa fa-keyboard-o'></i> " + data.person + " is typing.</small></li>");
        timeout = setTimeout(timeoutFunction, 5000);
      }
    } else {
      $("#"+data.person+"").remove();
    }
  });

  $("#showCreateRoom").click(function() {
    $("#createRoomForm").toggle();
  });

  $("#createRoomBtn").click(function() {
    var roomExists = false;
    var roomName = $("#createRoomName").val();
    socket.emit("checkRoomName", roomName, function(data) {
      roomExists = data.result;

      // Check to see if room exists
       if (roomExists) {
          $("#errors").empty();
          $("#errors").show();
          $("#errors").append("Room <i>" + roomName + "</i> already exists");
        } else {      
        if (roomName.length > 0) { //also check for roomname
          socket.emit("createRoom", roomName);
          $("#errors").empty();
          $("#errors").hide();
          }
        }
    });
  });

  $("#rooms").on('click', '.joinRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    socket.emit("joinRoom", roomID);
  });

  $("#rooms").on('click', '.removeRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    socket.emit("removeRoom", roomID);
    $("#createRoom").show();
  }); 

  $("#leave").click(function() {
    var roomID = myRoomID;
    socket.emit("leaveRoom", roomID);
    $("#createRoom").show();
  });

//socket-y stuff
socket.on("exists", function(data) {
  $("#errors").empty();
  $("#errors").show();
  $("#errors").append(data.msg + " Try <strong>" + data.proposedName + "</strong>");
    toggleNameForm();
    toggleChatWindow();
});

socket.on("joined", function() {
  $("#errors").hide();
        toggleEmojiPicker();

});

socket.on("history", function(data) {
  if (data.length !== 0) {
    $("#msgs").append("<li><strong><span class='text-warning'>Last 10 messages:</li>");
    $.each(data, function(data, msg) {
      $("#msgs").append("<li><span class='text-warning'>" + msg + "</span></li>");
    });
  } else {
    $("#msgs").append("<li><strong><span class='text-warning'>No past messages in this room.</li>");
  }
});

  socket.on("update", function(msg) {
    $("#msgs").append("<li>" + msg + "</li>");
  });

  socket.on("update-people", function(data){
    //var peopleOnline = [];
    $("#people").empty();
    $('#people').append("<li class=\"list-group-item active\">People online <span class=\"badge\">"+data.count+"</span></li>");
  });

  socket.on("chat", function(msTime, person, msg) {
    $("#msgs").append("<li><strong><span class='text-success'>" + timeFormat(msTime) + person.name + "</span></strong>: " + msg + "</li>");
    //clear typing field
     $("#"+person.name+"").remove();
     clearTimeout(timeout);
     timeout = setTimeout(timeoutFunction, 0);
  });

  socket.on("roomList", function(data) {
    $("#rooms").text("");
    $("#rooms").append("<li class=\"list-group-item active\">List of rooms <span class=\"badge\">"+data.count+"</span></li>");
     if (!jQuery.isEmptyObject(data.rooms)) { 
      $.each(data.rooms, function(id, room) {
        console.log("room msg")
        console.log(room)
        var unread;
        if(room.id == myRoomID){
          unread=0;
        }else{
          unread = room.messagesUnread[data.id]
        }
        room.messagesUnread[data.id]
        var html = "<button id="+id+" class='joinRoomBtn btn btn-default btn-xs' >Join</button>" + " " + "<button id="+id+" class='removeRoomBtn btn btn-default btn-xs'>Remove</button><span class=\"badge\">"+unread+"</span>";
        $('#rooms').append("<li id="+id+" class=\"list-group-item\"><span>" + room.name + "</span> " + html + "</li>");
      });
    } else {
      $("#rooms").append("<li class=\"list-group-item\">There are no rooms yet.</li>");
    }
  });

  socket.on("sendRoomID", function(data) {
    myRoomID = data.id;
  });

  socket.on("disconnect", function(){
    $("#msgs").append("<li><strong><span class='text-warning'>The server is not available</span></strong></li>");
    $("#msg").attr("disabled", "disabled");
    $("#send").attr("disabled", "disabled");
  });

});
