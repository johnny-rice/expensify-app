import type {RefObject} from 'react';
import React, {useEffect, useState} from 'react';
import type {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import {completePaymentOnboarding} from '@libs/actions/IOU';
import {hasRequestFromCurrentAccount} from '@libs/ReportActionsUtils';
import {isExpenseReport, isIOUReport} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {AnchorPosition} from '@src/styles';
import type {Report} from '@src/types/onyx';
import type AnchorAlignment from '@src/types/utils/AnchorAlignment';
import * as Expensicons from './Icon/Expensicons';
import type {PaymentMethod} from './KYCWall/types';
import type BaseModalProps from './Modal/types';
import PopoverMenu from './PopoverMenu';

type AddPaymentMethodMenuProps = {
    /** Should the component be visible? */
    isVisible: boolean;

    /** Callback to execute when the component closes. */
    onClose: () => void;

    /** Callback to execute when the payment method is selected. */
    onItemSelected: (paymentMethod: PaymentMethod) => void;

    /** The IOU/Expense report we are paying */
    iouReport?: OnyxEntry<Report>;

    /** Anchor position for the AddPaymentMenu. */
    anchorPosition: AnchorPosition;

    /** Where the popover should be positioned relative to the anchor points. */
    anchorAlignment?: AnchorAlignment;

    /** Popover anchor ref */
    anchorRef: RefObject<View | HTMLDivElement | null>;

    /** Whether the personal bank account option should be shown */
    shouldShowPersonalBankAccountOption?: boolean;
};

function AddPaymentMethodMenu({
    isVisible,
    onClose,
    anchorPosition,
    anchorAlignment = {
        horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT,
        vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
    },
    anchorRef,
    iouReport,
    onItemSelected,
    shouldShowPersonalBankAccountOption = false,
}: AddPaymentMethodMenuProps) {
    const {translate} = useLocalize();
    const [restoreFocusType, setRestoreFocusType] = useState<BaseModalProps['restoreFocusType']>();
    const [session] = useOnyx(ONYXKEYS.SESSION, {canBeMissing: true});

    // Users can choose to pay with business bank account in case of Expense reports or in case of P2P IOU report
    // which then starts a bottom up flow and creates a Collect workspace where the payer is an admin and payee is an employee.
    const isIOU = isIOUReport(iouReport);
    const canUseBusinessBankAccount = isExpenseReport(iouReport) || (isIOU && !hasRequestFromCurrentAccount(iouReport?.reportID, session?.accountID ?? CONST.DEFAULT_NUMBER_ID));

    const canUsePersonalBankAccount = shouldShowPersonalBankAccountOption || isIOU;

    const isPersonalOnlyOption = canUsePersonalBankAccount && !canUseBusinessBankAccount;

    // We temporarily disabled P2P debit cards so we will automatically select the personal bank account option if there is no other option to select.
    useEffect(() => {
        if (!isVisible || !isPersonalOnlyOption) {
            return;
        }

        completePaymentOnboarding(CONST.PAYMENT_SELECTED.PBA);
        onItemSelected(CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT);
    }, [isPersonalOnlyOption, isVisible, onItemSelected]);

    if (isPersonalOnlyOption) {
        return null;
    }

    return (
        <PopoverMenu
            isVisible={isVisible}
            onClose={() => {
                setRestoreFocusType(undefined);
                onClose();
            }}
            anchorPosition={anchorPosition}
            anchorAlignment={anchorAlignment}
            anchorRef={anchorRef}
            onItemSelected={() => {
                setRestoreFocusType(CONST.MODAL.RESTORE_FOCUS_TYPE.DELETE);
                onClose();
            }}
            menuItems={[
                ...(canUsePersonalBankAccount
                    ? [
                          {
                              text: translate('common.personalBankAccount'),
                              icon: Expensicons.Bank,
                              onSelected: () => {
                                  completePaymentOnboarding(CONST.PAYMENT_SELECTED.PBA);
                                  onItemSelected(CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT);
                              },
                          },
                      ]
                    : []),
                ...(canUseBusinessBankAccount
                    ? [
                          {
                              text: translate('common.businessBankAccount'),
                              icon: Expensicons.Building,
                              onSelected: () => {
                                  onItemSelected(CONST.PAYMENT_METHODS.BUSINESS_BANK_ACCOUNT);
                              },
                          },
                      ]
                    : []),
                // Adding a debit card for P2P payments is temporarily disabled
                // ...[
                //     {
                //         text: translate('common.debitCard'),
                //         icon: Expensicons.CreditCard,
                //         onSelected: () => onItemSelected(CONST.PAYMENT_METHODS.DEBIT_CARD),
                //     },
                // ],
            ]}
            shouldEnableNewFocusManagement
            restoreFocusType={restoreFocusType}
        />
    );
}

AddPaymentMethodMenu.displayName = 'AddPaymentMethodMenu';

export default AddPaymentMethodMenu;
