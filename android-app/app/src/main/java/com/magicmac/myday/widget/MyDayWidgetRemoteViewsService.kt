package com.magicmac.myday.widget

import android.content.Intent
import android.widget.RemoteViewsService

class MyDayWidgetRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return MyDayWidgetViewsFactory(applicationContext)
    }
}
