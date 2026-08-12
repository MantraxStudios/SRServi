package com.mantraxstudios.srservireceiver

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Estado en memoria compartido entre el servicio y la interfaz. */
object ReceiverState {

    enum class Status { STOPPED, WAITING, CONNECTED }

    data class Message(val text: String, val time: String)

    private val _status = MutableStateFlow(Status.STOPPED)
    val status: StateFlow<Status> = _status

    private val _connectedDevice = MutableStateFlow<String?>(null)
    val connectedDevice: StateFlow<String?> = _connectedDevice

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages

    private val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
    private const val MAX_MESSAGES = 500

    fun setStatus(status: Status) {
        _status.value = status
    }

    fun setConnectedDevice(name: String?) {
        _connectedDevice.value = name
    }

    fun addMessage(text: String) {
        val msg = Message(text, timeFmt.format(Date()))
        val list = ArrayList(_messages.value)
        list.add(0, msg)
        while (list.size > MAX_MESSAGES) list.removeAt(list.size - 1)
        _messages.value = list
    }

    fun clear() {
        _messages.value = emptyList()
    }
}
