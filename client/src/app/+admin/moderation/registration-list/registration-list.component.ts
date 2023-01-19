import { SortMeta } from 'primeng/api'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { MarkdownService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { DropdownAction } from '@app/shared/shared-main'
import { UserRegistration, UserRegistrationState } from '@shared/models'
import { AdminRegistrationService } from './admin-registration.service'
import { ProcessRegistrationModalComponent } from './process-registration-modal.component'

@Component({
  selector: 'my-registration-list',
  templateUrl: './registration-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss', './registration-list.component.scss' ]
})
export class RegistrationListComponent extends RestTable implements OnInit {
  @ViewChild('processRegistrationModal', { static: true }) processRegistrationModal: ProcessRegistrationModalComponent

  registrations: (UserRegistration & { registrationReasonHTML?: string, moderationResponseHTML?: string })[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  registrationActions: DropdownAction<UserRegistration>[][] = []

  inputFilters: AdvancedInputFilter[] = []

  requiresEmailVerification: boolean

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private server: ServerService,
    private notifier: Notifier,
    private markdownRenderer: MarkdownService,
    private adminRegistrationService: AdminRegistrationService
  ) {
    super()

    this.registrationActions = [
      [
        {
          label: $localize`Accept this registration`,
          handler: registration => this.openRegistrationRequestProcessModal(registration, 'accept'),
          isDisplayed: registration => registration.state.id === UserRegistrationState.PENDING
        },
        {
          label: $localize`Reject this registration`,
          handler: registration => this.openRegistrationRequestProcessModal(registration, 'reject'),
          isDisplayed: registration => registration.state.id === UserRegistrationState.PENDING
        },
        {
          label: $localize`Remove this registration request`,
          handler: registration => this.removeRegistration(registration),
          isDisplayed: registration => registration.state.id !== UserRegistrationState.PENDING
        }
      ]
    ]
  }

  ngOnInit () {
    this.initialize()

    this.server.getConfig()
      .subscribe(config => {
        this.requiresEmailVerification = config.signup.requiresEmailVerification
      })
  }

  getIdentifier () {
    return 'RegistrationListComponent'
  }

  isRegistrationAccepted (registration: UserRegistration) {
    return registration.state.id === UserRegistrationState.ACCEPTED
  }

  isRegistrationRejected (registration: UserRegistration) {
    return registration.state.id === UserRegistrationState.REJECTED
  }

  onRegistrationProcessed () {
    this.reloadData()
  }

  protected reloadData () {
    this.adminRegistrationService.listRegistrations({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe({
      next: async resultList => {
        this.totalRecords = resultList.total
        this.registrations = resultList.data

        for (const registration of this.registrations) {
          registration.registrationReasonHTML = await this.toHtml(registration.registrationReason)
          registration.moderationResponseHTML = await this.toHtml(registration.moderationResponse)
        }
      },

      error: err => this.notifier.error(err.message)
    })
  }

  private openRegistrationRequestProcessModal (registration: UserRegistration, mode: 'accept' | 'reject') {
    this.processRegistrationModal.openModal(registration, mode)
  }

  private removeRegistration (registration: UserRegistration) {
    this.adminRegistrationService.removeRegistration(registration)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Registration request deleted.`)
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text })
  }
}
